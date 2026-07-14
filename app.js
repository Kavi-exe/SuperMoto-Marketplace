// CeylonSuper Marketplace JS Engine

const API_BASE = "";

// ── Clean up only genuinely stale/fake data ────────────────────
// Remove the hardcoded fake profile if it was never replaced by a real one
(function clearFakeProfile() {
    try {
        const raw = localStorage.getItem("ceylonsuper_profile");
        if (raw) {
            const p = JSON.parse(raw);
            if (p.email === "suresh@domain.lk" || p.name === "Suresh Perera") {
                localStorage.removeItem("ceylonsuper_profile");
            }
        }
    } catch { /* ignore */ }
})();

let accessToken = sessionStorage.getItem("ceylon_access_token") || "";
let currentUser = null;
let appConfig = {};
let stripeInstance = null;
let stripeElements = null;
let paymentElement = null;
let pendingPaymentAdId = null;
let sparePartUploadedImages = [];
let pendingDeleteCallback = null;
let pendingRedirectView = null;
const PROTECTED_VIEWS = ["post-ad", "profile"];

async function apiFetch(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }
    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: "include",
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (response.status === 401 && !options._retried && path !== "/api/auth/refresh" && path !== "/api/auth/login") {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            return apiFetch(path, { ...options, _retried: true });
        }
    }

    return { response, data };
}

function setAccessToken(token) {
    accessToken = token || "";
    if (token) {
        sessionStorage.setItem("ceylon_access_token", token);
    } else {
        sessionStorage.removeItem("ceylon_access_token");
    }
}

async function refreshAccessToken() {
    const { response, data } = await apiFetch("/api/auth/refresh", { method: "POST" });
    if (response.ok && data?.accessToken) {
        setAccessToken(data.accessToken);
        currentUser = data.user || currentUser;
        updateAuthUI();
        return true;
    }
    setAccessToken("");
    currentUser = null;
    updateAuthUI();
    return false;
}

async function loadPublicConfig() {
    try {
        const { response, data } = await apiFetch("/api/config/public");
        if (response.ok && data) {
            appConfig = data;
            // Server is reachable — hide offline banner
            const banner = document.getElementById("server-offline-banner");
            if (banner) banner.style.display = "none";
        } else {
            showServerOfflineBanner();
        }
    } catch {
        appConfig = {};
        showServerOfflineBanner();
    }
}

function showServerOfflineBanner() {
    const banner = document.getElementById("server-offline-banner");
    if (banner) banner.style.display = "block";
    // Also disable the login/register forms with a clear message
    ["login-error", "register-error"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = "Server is offline. Start the server first: cd server && npm start";
    });
}

async function initAuth() {
    // If we already detected the server is offline, skip
    const banner = document.getElementById("server-offline-banner");
    if (banner && banner.style.display !== "none") return;

    if (accessToken) {
        try {
            const { response, data } = await apiFetch("/api/auth/me");
            if (response.ok && data?.user) {
                currentUser = data.user;
                updateAuthUI();
                return;
            }
        } catch {
            return; // server unreachable — silently skip
        }
    }
    // Only try refresh if we have a token or might have a valid cookie
    try {
        await refreshAccessToken();
    } catch {
        // server unreachable — ignore
    }
}

async function uploadImagesToCloud(filesOrData) {
    const formData = new FormData();

    for (const item of filesOrData) {
        if (item instanceof File) {
            formData.append("images", item);
        } else if (typeof item === "string" && item.startsWith("data:")) {
            const blob = await fetch(item).then((r) => r.blob());
            formData.append("images", blob, "upload.jpg");
        }
    }

    if (!formData.has("images")) {
        return [];
    }

    const { response, data } = await apiFetch("/api/upload/images", {
        method: "POST",
        body: formData,
        headers: {},
    });

    if (!response.ok) {
        throw new Error(data?.error || "Image upload failed");
    }

    return data.urls || [];
}

async function fetchAdsFromServer() {
    try {
        const { response, data } = await apiFetch("/api/ads");
        if (response.ok && Array.isArray(data?.ads)) {
            ads = data.ads;
            return true;
        }
    } catch {
        /* fallback to local */
    }
    return false;
}

async function fetchSparePartsFromServer() {
    try {
        const { response, data } = await apiFetch("/api/spare-parts");
        if (response.ok && Array.isArray(data?.spareParts)) {
            spareParts = data.spareParts;
            return true;
        }
    } catch {
        /* fallback to local */
    }
    return false;
}

function updateAuthUI() {
    const loginLink = document.getElementById("nav-login-link");
    const logoutBtn = document.getElementById("nav-logout-btn");
    const profileLink = document.getElementById("nav-profile-link");
    const postBtn = document.getElementById("nav-post-ad-btn");

    if (currentUser) {
        if (loginLink) loginLink.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "inline-flex";
        if (profileLink) profileLink.style.display = "";
        if (postBtn) postBtn.style.display = "";
    } else {
        if (loginLink) loginLink.style.display = "";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (profileLink) profileLink.style.display = "";
        if (postBtn) postBtn.style.display = "";
    }
}

function requireAuthForView(viewName) {
    if (!PROTECTED_VIEWS.includes(viewName)) return true;
    if (currentUser) return true;
    pendingRedirectView = viewName;
    switchView("login");
    return false;
}

function showDeleteConfirmModal(message, onConfirm) {
    const modal = document.getElementById("delete-modal-container");
    const msgEl = document.getElementById("delete-modal-message");
    if (!modal || !msgEl) return;

    msgEl.textContent = message || "Are you sure you want to remove this listing? This action cannot be undone.";
    pendingDeleteCallback = onConfirm;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeDeleteConfirmModal() {
    const modal = document.getElementById("delete-modal-container");
    if (modal) modal.classList.remove("active");
    pendingDeleteCallback = null;
    document.body.style.overflow = "";
}

function parseEngineCapacity(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function validateEngineCapacity(showError = true) {
    const input = document.getElementById("ad-engine-capacity");
    const errorEl = document.getElementById("engine-capacity-error");
    if (!input) return true;

    const capacity = parseEngineCapacity(input.value);
    const invalid = !capacity || capacity <= 250;

    if (errorEl) {
        errorEl.style.display = invalid && showError ? "block" : "none";
    }
    if (input) {
        input.style.borderColor = invalid && showError ? "#dc2626" : "";
    }

    return !invalid;
}

// Preloaded mock database for supercars and superbikes
const PRELOADED_ADS = [
    {
        id: "cs-1",
        title: "Ferrari 812 Superfast V12",
        type: "supercar",
        make: "Ferrari",
        model: "812 Superfast",
        year: 2021,
        price: 195000000, // LKR
        location: "Colombo",
        mileage: 3200, // km
        transmission: "Dual-Clutch",
        fuel: "Petrol",
        engine: "6.5L V12",
        power: "800 hp",
        topSpeed: 340, // km/h
        zeroToHundred: "2.9s",
        condition: "Registered",
        dutyStatus: "Duty Paid",
        sellerName: "Avantha Cars Ltd",
        sellerPhone: "+94 77 123 4567",
        sellerEmail: "sales@avantha.lk",
        description: "An absolute masterpiece of automotive engineering. Finished in classic Rosso Corsa with Nero leather interior. Fully optioned from factory, including carbon fibre steering wheel with LEDs, passenger display, carbon racing seats, and suspension lifter. Complete service history at official dealer. In pristine, mint condition.",
        images: [
            "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?auto=format&fit=crop&w=800&q=80"
        ],
        dateAdded: "2026-05-28",
        featured: true
    },
    {
        id: "cs-2",
        title: "Ducati Panigale V4 S",
        type: "superbike",
        make: "Ducati",
        model: "Panigale V4 S",
        year: 2022,
        price: 18500000,
        location: "Kandy",
        mileage: 1800,
        transmission: "Sequential",
        fuel: "Petrol",
        engine: "1103cc Desmosedici V4",
        power: "214 hp",
        topSpeed: 312,
        zeroToHundred: "3.0s",
        condition: "Registered",
        dutyStatus: "Duty Paid",
        sellerName: "Superbike Ceylon",
        sellerPhone: "+94 71 888 9911",
        sellerEmail: "info@sbceylon.lk",
        description: "2022 Ducati Panigale V4 S in absolute mint condition. Includes full titanium Akrapovič exhaust system (mapped), carbon fiber mudguards, winglets, and dry clutch conversion. Öhlins electronic suspension, Brembo Stylema calipers. Carefully ridden, serviced every 500km. A true Italian racing icon.",
        images: [
            "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=800&q=80"
        ],
        dateAdded: "2026-05-27",
        featured: true
    },
    {
        id: "cs-3",
        title: "Porsche 911 GT3 RS (992)",
        type: "supercar",
        make: "Porsche",
        model: "911 GT3 RS",
        year: 2023,
        price: 185000000,
        location: "Colombo",
        mileage: 650,
        transmission: "PDK (Automatic)",
        fuel: "Petrol",
        engine: "4.0L Naturally Aspirated Flat-6",
        power: "518 hp",
        topSpeed: 296,
        zeroToHundred: "3.2s",
        condition: "Brand New",
        dutyStatus: "Duty Paid",
        sellerName: "Elite Performance Lanka",
        sellerPhone: "+94 77 999 1122",
        sellerEmail: "contact@elitelanka.com",
        description: "The ultimate track weapon. Weissach Package. Finished in Lizard Green with Satin Black wheels. Magnesium wheels, active aerodynamics (DRS), carbon fiber roll cage, bucket seats. Unregistered, duties fully paid. Serious buyers only.",
        images: [
            "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1562591176-7fa297597148?auto=format&fit=crop&w=800&q=80"
        ],
        dateAdded: "2026-05-29",
        featured: true
    },
    {
        id: "cs-4",
        title: "Yamaha YZF-R1M",
        type: "superbike",
        make: "Yamaha",
        model: "YZF-R1M",
        year: 2021,
        price: 11800000,
        location: "Negombo",
        mileage: 4800,
        transmission: "Manual",
        fuel: "Petrol",
        engine: "998cc Crossplane inline-4",
        power: "200 hp",
        topSpeed: 299,
        zeroToHundred: "3.1s",
        condition: "Registered",
        dutyStatus: "Duty Paid",
        sellerName: "Dilshan Moto",
        sellerPhone: "+94 76 543 2109",
        sellerEmail: "dilshan.m@gmail.com",
        description: "Carbon fiber bodywork, Öhlins Electronic Racing Suspension (ERS), Communication Control Unit (CCU) with GPS. Brand new Bridgestone Battlax RS11 tires. Extremely rare R1M. Impeccably clean, no drops, no scratches.",
        images: [
            "https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?auto=format&fit=crop&w=800&q=80"
        ],
        dateAdded: "2026-05-25",
        featured: false
    },
    {
        id: "cs-5",
        title: "Lamborghini Huracán Evo V10",
        type: "supercar",
        make: "Lamborghini",
        model: "Huracán Evo",
        year: 2020,
        price: 168000000,
        location: "Galle",
        mileage: 4900,
        transmission: "Automatic",
        fuel: "Petrol",
        engine: "5.2L V10",
        power: "640 hp",
        topSpeed: 325,
        zeroToHundred: "2.9s",
        condition: "Reconditioned",
        dutyStatus: "Duty Paid",
        sellerName: "Jayasinghe Motors",
        sellerPhone: "+94 77 555 7777",
        sellerEmail: "jayasinghe@mail.lk",
        description: "Finished in gorgeous Arancio Xanto (metallic orange) with black Alcantara sporty cabin. LDVI vehicle dynamics controller, rear-wheel steering, 8.4-inch touchscreen console. Capristo exhaust system installed. Beautiful sounding V10.",
        images: [
            "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1614200187471-9653b02223a7?auto=format&fit=crop&w=800&q=80"
        ],
        dateAdded: "2026-05-24",
        featured: false
    },
    {
        id: "cs-6",
        title: "Kawasaki Ninja H2 Carbon",
        type: "superbike",
        make: "Kawasaki",
        model: "Ninja H2",
        year: 2022,
        price: 26500000,
        location: "Colombo",
        mileage: 950,
        transmission: "Manual",
        fuel: "Petrol",
        engine: "998cc Supercharged inline-4",
        power: "231 hp",
        topSpeed: 337,
        zeroToHundred: "2.6s",
        condition: "Registered",
        dutyStatus: "Duty Paid",
        sellerName: "Apex Racing Group",
        sellerPhone: "+94 70 700 8000",
        sellerEmail: "contact@apexracing.lk",
        description: "Supercharged hyperbike. Carbon fiber front cowl, Ohlins TTX36 rear shock, Brembo Stylema brakes. Hand-painted mirror coated paint with real silver flakes. Launch control, engine brake control. Only 1 in Sri Lanka in this configuration.",
        images: [
            "https://images.unsplash.com/photo-1615887023516-9b6bcd559e87?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1569796003055-116b0407d50b?auto=format&fit=crop&w=800&q=80"
        ],
        dateAdded: "2026-05-28",
        featured: true
    },
    {
        id: "cs-7",
        title: "Nissan GT-R Nismo Edition",
        type: "supercar",
        make: "Nissan",
        model: "GT-R",
        year: 2019,
        price: 92000000,
        location: "Gampaha",
        mileage: 11000,
        transmission: "Automatic",
        fuel: "Petrol",
        engine: "3.8L Twin-Turbo V6",
        power: "600 hp",
        topSpeed: 315,
        zeroToHundred: "2.8s",
        condition: "Registered",
        dutyStatus: "Duty Paid",
        sellerName: "Premium Auto Imports",
        sellerPhone: "+94 77 444 8888",
        sellerEmail: "imports@premiumauto.lk",
        description: "Official Nismo Edition. Upgraded turbochargers from GT3 race car, carbon fiber hood, roof, trunk lid, and wing. Recaro carbon shell bucket seats, Bilstein Damptronic dampers. Fully serviced at Nissan High Performance Center. Ultimate street weapon.",
        images: [
            "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1525609004556-c46c7d6cf0a3?auto=format&fit=crop&w=800&q=80"
        ],
        dateAdded: "2026-05-22",
        featured: false
    },
    {
        id: "cs-8",
        title: "BMW S1000RR M-Package",
        type: "superbike",
        make: "BMW",
        model: "S1000RR",
        year: 2022,
        price: 15200000,
        location: "Kurunegala",
        mileage: 2200,
        transmission: "Manual",
        fuel: "Petrol",
        engine: "999cc ShiftCam inline-4",
        power: "205 hp",
        topSpeed: 306,
        zeroToHundred: "2.9s",
        condition: "Registered",
        dutyStatus: "Duty Paid",
        sellerName: "Ranjith Motors",
        sellerPhone: "+94 72 333 4455",
        sellerEmail: "ranjith.motors@yahoo.com",
        description: "2022 BMW S1000RR with official M-Package. Includes M Carbon wheels, M Sport seat, M lightweight battery, and M chassis kit. Dynamic Damping Control (DDC), Pro Riding Modes, Shift Assistant Pro. Full Akrapovič carbon muffler. Absolute showroom condition.",
        images: [
            "https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80"
        ],
        dateAdded: "2026-05-26",
        featured: false
    }
];

// Highlight Accents Colors preset mappings
const ACCENT_PRESETS = {
    crimson: {
        primary: "#ff2a55",
        glow: "rgba(255, 42, 85, 0.3)",
        hover: "#ff4d72"
    },
    blue: {
        primary: "#1a6fff",
        glow: "rgba(26, 111, 255, 0.35)",
        hover: "#4d8fff"
    },
    gold: {
        primary: "#ffb300",
        glow: "rgba(255, 179, 0, 0.3)",
        hover: "#ffd54f"
    },
    green: {
        primary: "#00e676",
        glow: "rgba(0, 230, 118, 0.3)",
        hover: "#33ff9b"
    },
    orange: {
        primary: "#ff5a00",
        glow: "rgba(255, 90, 0, 0.4)",
        hover: "#ff7629"
    }
};

// App State
let ads = [];
let favorites = [];
let spareParts = [];
let profile = {};
let settings = {};
let currentFilters = {
    type: "all",
    make: "all",
    location: "all",
    priceMin: "",
    priceMax: "",
    yearMin: "",
    yearMax: "",
    transmission: "all",
    condition: "all",
    keyword: ""
};
let viewMode = "list"; // list or grid
let activeStep = 1;
let uploadedImages = [];
let profilePhotoDraft = "";

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
    await loadPublicConfig();
    initDatabase();
    await initAuth();
    await fetchAdsFromServer();
    await fetchSparePartsFromServer();
    bindEvents();
    renderSidebarCounts();
    renderListings();
    updateFavBadge();
    initParticleCanvas();
});
// Database Init
function initDatabase() {
    // Check if ads already exist in localStorage
    const savedAds = localStorage.getItem("ceylonsuper_ads");
    if (savedAds) {
        ads = JSON.parse(savedAds);
    } else {
        ads = [...PRELOADED_ADS];
        localStorage.setItem("ceylonsuper_ads", JSON.stringify(ads));
    }

    // Check favorites
    const savedFavs = localStorage.getItem("ceylonsuper_favorites");
    if (savedFavs) {
        favorites = JSON.parse(savedFavs);
    } else {
        favorites = [];
        localStorage.setItem("ceylonsuper_favorites", JSON.stringify(favorites));
    }

    // Check spare parts
    const savedSpareParts = localStorage.getItem("ceylonsuper_spare_parts");
    if (savedSpareParts) {
        spareParts = JSON.parse(savedSpareParts);
    } else {
        spareParts = [];
        localStorage.setItem("ceylonsuper_spare_parts", JSON.stringify(spareParts));
    }

    // Initialize Profile
    const savedProfile = localStorage.getItem("ceylonsuper_profile");
    if (savedProfile) {
        profile = JSON.parse(savedProfile);
    } else {
        profile = {
            name: "",
            phone: "",
            email: "",
            location: "",
            bio: "",
            avatar: ""
        };
        localStorage.setItem("ceylonsuper_profile", JSON.stringify(profile));
    }

    // Initialize Settings
    const savedSettings = localStorage.getItem("ceylonsuper_settings");
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
        // Migrate old default crimson accent to blue
        if (settings.accent === "crimson") {
            settings.accent = "blue";
            localStorage.setItem("ceylonsuper_settings", JSON.stringify(settings));
        }
    } else {
        settings = {
            theme: "dark",
            accent: "blue", // default color: Blue
            emailNotifications: true,
            publicProfile: true
        };
        localStorage.setItem("ceylonsuper_settings", JSON.stringify(settings));
    }

    // Apply Settings (Theme + Colors)
    applyThemeSettings();
}

// Apply theme base and accents variables to CSS DOM
function applyThemeSettings() {
    // Base Theme Mode (Dark/Light)
    if (settings.theme === "light") {
        document.body.classList.remove("theme-dark");
        document.body.classList.add("theme-light");
        const themeToggle = document.getElementById("settings-toggle-theme");
        if (themeToggle) themeToggle.checked = true;
    } else {
        document.body.classList.remove("theme-light");
        document.body.classList.add("theme-dark");
        const themeToggle = document.getElementById("settings-toggle-theme");
        if (themeToggle) themeToggle.checked = false;
    }

    // Ceylon Force logo swap on theme change
    setCeylonForceLogoForCurrentTheme();

    // Accent Highlighting variables
    const accentData = ACCENT_PRESETS[settings.accent] || ACCENT_PRESETS.blue;
    const root = document.documentElement;
    root.style.setProperty("--accent-primary", accentData.primary);
    root.style.setProperty("--accent-primary-glow", accentData.glow);
    root.style.setProperty("--accent-primary-hover", accentData.hover);
    root.style.setProperty("--accent-gradient", `linear-gradient(135deg, ${accentData.primary} 0%, ${accentData.hover} 100%)`);

    // Sync accent picker circles in UI
    document.querySelectorAll("#settings-accent-picker .accent-color-dot").forEach(dot => {
        if (dot.getAttribute("data-accent") === settings.accent) {
            dot.classList.add("active");
        } else {
            dot.classList.remove("active");
        }
    });

    // Sync other checkboxes
    const emailToggle = document.getElementById("settings-notify-email");
    if (emailToggle) emailToggle.checked = settings.emailNotifications;

    const publicToggle = document.getElementById("settings-public-profile");
    if (publicToggle) publicToggle.checked = settings.publicProfile;
}

// Bind UI Events
function bindEvents() {
    // Navigation / Routing
    document.querySelectorAll("[data-target-view]").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const view = link.getAttribute("data-target-view");
            if (!requireAuthForView(view)) return;
            switchView(view);
        });
    });

    // Mobile navigation toggle
    const mobileNavToggle = document.getElementById("mobile-nav-toggle");
    const mainNavigation = document.getElementById("main-navigation");
    if (mobileNavToggle && mainNavigation) {
        mobileNavToggle.addEventListener("click", () => {
            setMobileNavOpen(!mainNavigation.classList.contains("is-open"));
        });

        mainNavigation.querySelectorAll("[data-target-view]").forEach(item => {
            item.addEventListener("click", () => setMobileNavOpen(false));
        });

        document.addEventListener("click", (event) => {
            if (!mainNavigation.classList.contains("is-open")) return;
            if (mainNavigation.contains(event.target) || mobileNavToggle.contains(event.target)) return;
            setMobileNavOpen(false);
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 780) setMobileNavOpen(false);
        });
    }

    // View Toggles
    const listBtn = document.getElementById("view-list-btn");
    const gridBtn = document.getElementById("view-grid-btn");
    if (listBtn && gridBtn) {
        listBtn.addEventListener("click", () => {
            viewMode = "list";
            listBtn.classList.add("active");
            gridBtn.classList.remove("active");
            renderListings();
        });
        gridBtn.addEventListener("click", () => {
            viewMode = "grid";
            gridBtn.classList.add("active");
            listBtn.classList.remove("active");
            renderListings();
        });
    }

    // Sort Dropdown
    const sortSelect = document.getElementById("sort-select");
    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            renderListings();
        });
    }

    // Custom Dropdowns
    initCustomDropdown("filter-type", () => {
        updateFiltersFromForm();
        renderListings();
    });
    initCustomDropdown("filter-make", () => {
        updateFiltersFromForm();
        renderListings();
    });
    initCustomDropdown("filter-location", () => {
        updateFiltersFromForm();
        renderListings();
    });
    initCustomDropdown("sort-select", () => {
        renderListings();
    });
    initCustomDropdown("ad-type");
    initCustomDropdown("ad-condition");
    initCustomDropdown("ad-duty");
    initCustomDropdown("ad-transmission");
    initCustomDropdown("ad-fuel");
    initCustomDropdown("ad-seller-location");
    initCustomDropdown("prof-location");
    initCustomDropdown("spare-part-category");
    initCustomDropdown("spare-condition");
    initCustomDropdown("spare-location");


    // Search Console Inputs
    const searchForm = document.getElementById("search-console-form");
    if (searchForm) {
        searchForm.addEventListener("submit", (e) => {
            e.preventDefault();
            updateFiltersFromForm();
            renderListings();
        });
    }

    const resetBtn = document.getElementById("btn-reset-filters");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            resetFilters();
        });
    }

    // Quick Type Tabs
    document.querySelectorAll(".quick-type-tabs .tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetView = btn.getAttribute("data-view");
            if (targetView) {
                document.querySelectorAll(".quick-type-tabs .tab-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                switchView(targetView);
                return;
            }

            const type = btn.getAttribute("data-type");
            if (!type) return;
            document.querySelectorAll(".quick-type-tabs .tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilters.type = type;
            renderListings();
        });
    });

    // Post Ad Step Navigation
    const nextBtns = document.querySelectorAll(".btn-step-next");
    nextBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            if (validateStep(activeStep)) {
                goToStep(activeStep + 1);
            }
        });
    });

    const prevBtns = document.querySelectorAll(".btn-step-prev");
    prevBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            goToStep(activeStep - 1);
        });
    });

    // Image Upload Zone
    const dropzone = document.getElementById("upload-dropzone");
    const fileInput = document.getElementById("ad-files");
    if (dropzone && fileInput) {
        dropzone.addEventListener("click", () => fileInput.click());
        dropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzone.style.borderColor = "var(--accent-cyan)";
        });
        dropzone.addEventListener("dragleave", () => {
            dropzone.style.borderColor = "var(--border-color)";
        });
        dropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzone.style.borderColor = "var(--border-color)";
            if (e.dataTransfer.files.length) {
                handleUploadedFiles(e.dataTransfer.files);
            }
        });
        fileInput.addEventListener("change", (e) => {
            if (fileInput.files.length) {
                handleUploadedFiles(fileInput.files);
            }
        });
    }

    // Submit Ad Form
    const submitBtn = document.getElementById("btn-submit-ad");
    if (submitBtn) {
        submitBtn.addEventListener("click", async () => {
            if (validateStep(activeStep)) {
                await submitNewAd();
            }
        });
    }

    // Spare Parts Form
    const sparePartsForm = document.getElementById("spare-parts-form");
    const sparePartsReset = document.getElementById("btn-reset-spare-form");
    if (sparePartsForm) {
        sparePartsForm.addEventListener("submit", (event) => {
            event.preventDefault();
            submitSparePart();
        });
    }
    if (sparePartsReset) {
        sparePartsReset.addEventListener("click", resetSparePartsForm);
    }

    // Details Modal Close
    const closeBtn = document.getElementById("details-modal-close");
    const modal = document.getElementById("details-modal-container");
    if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => {
            modal.classList.remove("active");
            document.body.style.overflow = "";
        });
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.classList.remove("active");
                document.body.style.overflow = "";
            }
        });
    }

    // Chat Simulator
    const sendChatBtn = document.getElementById("chat-send-btn");
    const chatInput = document.getElementById("chat-input");
    if (sendChatBtn && chatInput) {
        sendChatBtn.addEventListener("click", sendMessage);
        chatInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") sendMessage();
        });
    }

    const closeChatBtn = document.getElementById("chat-close-btn");
    const chatModal = document.getElementById("chat-simulator-modal");
    if (closeChatBtn && chatModal) {
        closeChatBtn.addEventListener("click", () => {
            chatModal.classList.remove("active");
        });
    }

    // Profile photo upload
    const profilePhotoUploader = document.getElementById("profile-photo-uploader");
    const profilePhotoInput = document.getElementById("profile-photo-file");
    const profilePhotoBrowse = document.getElementById("profile-photo-browse");
    if (profilePhotoUploader && profilePhotoInput) {
        profilePhotoUploader.addEventListener("click", () => profilePhotoInput.click());
        if (profilePhotoBrowse) {
            profilePhotoBrowse.addEventListener("click", (event) => {
                event.stopPropagation();
                profilePhotoInput.click();
            });
        }
        profilePhotoInput.addEventListener("change", () => {
            const file = profilePhotoInput.files && profilePhotoInput.files[0];
            if (file) handleProfilePhotoFile(file);
        });
    }

    // Profile Save Button
    const saveProfileBtn = document.getElementById("btn-save-profile");
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener("click", saveUserProfile);
    }

    // Profile Sub-Tabs controller
    document.querySelectorAll("[data-profile-tab]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("[data-profile-tab]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const tabName = btn.getAttribute("data-profile-tab");
            document.querySelectorAll(".profile-tab-panel").forEach(panel => {
                if (panel.id === `panel-${tabName}`) {
                    panel.classList.add("active");
                } else {
                    panel.classList.remove("active");
                }
            });
        });
    });

    // Settings switches bindings
    const themeToggle = document.getElementById("settings-toggle-theme");
    if (themeToggle) {
        themeToggle.addEventListener("change", () => {
            settings.theme = themeToggle.checked ? "light" : "dark";
            localStorage.setItem("ceylonsuper_settings", JSON.stringify(settings));
            applyThemeSettings();
        });
    }

    document.querySelectorAll("#settings-accent-picker .accent-color-dot").forEach(dot => {
        dot.addEventListener("click", () => {
            const accent = dot.getAttribute("data-accent");
            settings.accent = accent;
            localStorage.setItem("ceylonsuper_settings", JSON.stringify(settings));
            applyThemeSettings();
        });
    });

    const emailToggle = document.getElementById("settings-notify-email");
    if (emailToggle) {
        emailToggle.addEventListener("change", () => {
            settings.emailNotifications = emailToggle.checked;
            localStorage.setItem("ceylonsuper_settings", JSON.stringify(settings));
        });
    }

    const publicToggle = document.getElementById("settings-public-profile");
    if (publicToggle) {
        publicToggle.addEventListener("change", () => {
            settings.publicProfile = publicToggle.checked;
            localStorage.setItem("ceylonsuper_settings", JSON.stringify(settings));
        });
    }

    document.querySelectorAll("[data-info-tab]").forEach(btn => {
        btn.addEventListener("click", () => {
            openInfoTab(btn.getAttribute("data-info-tab"));
        });
    });

    // Login / Register tab switcher
    document.getElementById("tab-signin")?.addEventListener("click", () => switchLoginTab("signin"));
    document.getElementById("tab-register")?.addEventListener("click", () => switchLoginTab("register"));

    // Login form submit
    document.getElementById("login-form")?.addEventListener("submit", (e) => { e.preventDefault(); handleLogin(); });

    // Register form submit
    document.getElementById("register-form")?.addEventListener("submit", (e) => { e.preventDefault(); handleRegister(); });

    // OTP verification form submit
    document.getElementById("register-verify-form")?.addEventListener("submit", (e) => { e.preventDefault(); handleVerifyRegistration(); });

    // Ensure OTP form visibility matches tab state
    const verifyForm = document.getElementById("register-verify-form");
    if (verifyForm) {
        verifyForm.addEventListener("transitionend", () => {});
    }

    // Password toggles
    document.getElementById("toggle-login-pw")?.addEventListener("click", () => {
        const inp = document.getElementById("login-password");
        const ico = document.querySelector("#toggle-login-pw i");
        inp.type = inp.type === "password" ? "text" : "password";
        ico?.classList.toggle("fa-eye-slash", inp.type === "password");
        ico?.classList.toggle("fa-eye", inp.type === "text");
    });
    document.getElementById("toggle-register-pw")?.addEventListener("click", () => {
        const inp = document.getElementById("register-password");
        const ico = document.querySelector("#toggle-register-pw i");
        inp.type = inp.type === "password" ? "text" : "password";
        ico?.classList.toggle("fa-eye-slash", inp.type === "password");
        ico?.classList.toggle("fa-eye", inp.type === "text");
    });

    // Logout
    document.getElementById("nav-logout-btn")?.addEventListener("click", handleLogout);

    // Google OAuth popup
    const googleBtns = document.querySelectorAll(".login-social-btn[data-provider='google']");
    googleBtns.forEach(btn => {
        btn.removeAttribute("disabled");
        btn.setAttribute("title", "Sign in with Google");
        btn.addEventListener("click", handleGoogleLogin);
    });

    // Apple — not yet available, show informative message
    const appleBtns = document.querySelectorAll(".login-social-btn[data-provider='apple']");
    appleBtns.forEach(btn => {
        btn.removeAttribute("disabled");
        btn.setAttribute("title", "Sign in with Apple");
        btn.addEventListener("click", () => {
            showToast("Apple Sign‑In is not available yet. Please use email or Google.", "info");
        });
    });

    // Listen for Google OAuth popup callback
    window.addEventListener("message", (event) => {
        if (event.data?.type === "GOOGLE_AUTH_SUCCESS") {
            handleGoogleAuthSuccess(event.data);
        }
    });

    // Engine capacity validation
    const engineCapacityInput = document.getElementById("ad-engine-capacity");
    if (engineCapacityInput) {
        engineCapacityInput.addEventListener("blur", () => validateEngineCapacity(true));
        engineCapacityInput.addEventListener("input", () => {
            if (parseEngineCapacity(engineCapacityInput.value) > 250) {
                validateEngineCapacity(false);
            }
        });
    }

    // Spare parts image upload
    const spareDropzone = document.getElementById("spare-upload-dropzone");
    const spareFileInput = document.getElementById("spare-part-files");
    if (spareDropzone && spareFileInput) {
        spareDropzone.addEventListener("click", () => spareFileInput.click());
        spareDropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            spareDropzone.style.borderColor = "var(--accent-cyan)";
        });
        spareDropzone.addEventListener("dragleave", () => {
            spareDropzone.style.borderColor = "var(--border-color)";
        });
        spareDropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            spareDropzone.style.borderColor = "var(--border-color)";
            if (e.dataTransfer.files.length) {
                handleSparePartFiles(e.dataTransfer.files);
            }
        });
        spareFileInput.addEventListener("change", () => {
            if (spareFileInput.files.length) {
                handleSparePartFiles(spareFileInput.files);
            }
        });
    }

    // Payment modal
    const paymentClose = document.getElementById("payment-modal-close");
    const paymentModal = document.getElementById("payment-modal-container");
    if (paymentClose && paymentModal) {
        paymentClose.addEventListener("click", closePaymentModal);
        paymentModal.addEventListener("click", (e) => {
            if (e.target === paymentModal) closePaymentModal();
        });
    }

    const confirmPaymentBtn = document.getElementById("btn-confirm-payment");
    if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener("click", confirmStripePayment);
    }

    // Delete modal
    const deleteCancel = document.getElementById("delete-modal-cancel");
    const deleteConfirm = document.getElementById("delete-modal-confirm");
    const deleteModal = document.getElementById("delete-modal-container");
    if (deleteCancel) {
        deleteCancel.addEventListener("click", closeDeleteConfirmModal);
    }
    if (deleteConfirm) {
        deleteConfirm.addEventListener("click", async () => {
            if (pendingDeleteCallback) {
                await pendingDeleteCallback();
            }
            closeDeleteConfirmModal();
        });
    }
    if (deleteModal) {
        deleteModal.addEventListener("click", (e) => {
            if (e.target === deleteModal) closeDeleteConfirmModal();
        });
    }
}

function setMobileNavOpen(isOpen) {
    const mobileNavToggle = document.getElementById("mobile-nav-toggle");
    const mainNavigation = document.getElementById("main-navigation");
    if (!mobileNavToggle || !mainNavigation) return;

    mainNavigation.classList.toggle("is-open", isOpen);
    mobileNavToggle.classList.toggle("is-open", isOpen);
    mobileNavToggle.setAttribute("aria-expanded", String(isOpen));

    const icon = mobileNavToggle.querySelector("i");
    if (icon) {
        icon.className = isOpen ? "fas fa-times" : "fas fa-bars";
    }
}

function initParticleCanvas() {
    const canvas = document.getElementById("particle-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let particles = [];
    let animationId = null;
    let mouseX = 0;
    let mouseY = 0;

    const PARTICLE_COUNT = 120;
    const CONNECTION_DIST = 150;

    function resize() {
        const hero = canvas.parentElement;
        const rect = hero.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + "px";
        canvas.style.height = rect.height + "px";
        ctx.scale(dpr, dpr);
    }

    function createParticles() {
        particles = [];
        const w = canvas.width / (window.devicePixelRatio || 1);
        const h = canvas.height / (window.devicePixelRatio || 1);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.6,
                vy: (Math.random() - 0.5) * 0.6,
                r: Math.random() * 2.5 + 0.8,
                alpha: Math.random() * 0.5 + 0.2,
                hue: Math.random() > 0.5 ? 350 : 190, // red-ish or cyan-ish
            });
        }
    }

    function draw() {
        const w = canvas.width / (window.devicePixelRatio || 1);
        const h = canvas.height / (window.devicePixelRatio || 1);

        ctx.clearRect(0, 0, w, h);

        // Update and draw particles
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            // Movement
            p.x += p.vx;
            p.y += p.vy;

            // Wrap around
            if (p.x < -10) p.x = w + 10;
            if (p.x > w + 10) p.x = -10;
            if (p.y < -10) p.y = h + 10;
            if (p.y > h + 10) p.y = -10;

            // Draw particle
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.alpha})`;
            ctx.fill();

            // Glow
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.alpha * 0.12})`;
            ctx.fill();
        }

        // Draw connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const a = particles[i];
                const b = particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < CONNECTION_DIST) {
                    const alpha = (1 - dist / CONNECTION_DIST) * 0.15;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                    ctx.lineWidth = 0.6;
                    ctx.stroke();
                }
            }
        }

        animationId = requestAnimationFrame(draw);
    }

    resize();
    createParticles();
    draw();

    window.addEventListener("resize", () => {
        resize();
        createParticles();
    });
}

// Switch SPA views
function switchView(viewName) {
    setMobileNavOpen(false);

    // Update active nav links
    document.querySelectorAll("[data-target-view]").forEach(link => {
        if (link.getAttribute("data-target-view") === viewName) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });

    // Hide/Show main layout or custom views
    const homeLayout = document.getElementById("home-layout-section");
    const postAdSection = document.getElementById("post-ad-section");
    const sparePartsSection = document.getElementById("spare-parts-section");
    const infoSection = document.getElementById("info-section");
    const profileSection = document.getElementById("profile-section");
    const loginSection = document.getElementById("login-section");
    const announcementsSection = document.getElementById("announcements-section");

    [postAdSection, sparePartsSection, infoSection, profileSection, loginSection, announcementsSection].forEach(el => {
        if (el) el.classList.remove("active");
    });

    if (viewName === "home") {
        homeLayout.style.display = "block";
        currentFilters = {
            type: "all",
            make: "all",
            location: "all",
            priceMin: "",
            priceMax: "",
            yearMin: "",
            yearMax: "",
            transmission: "all",
            condition: "all",
            keyword: ""
        };
        // Reset type tabs
        document.querySelectorAll(".quick-type-tabs .tab-btn").forEach(b => {
            b.classList.remove("active");
            if (b.getAttribute("data-type") === "all") b.classList.add("active");
        });
        renderListings();
    } else if (viewName === "post-ad") {
        homeLayout.style.display = "none";
        postAdSection.classList.add("active");
        resetPostForm();
        prefillPostAdFormFromProfile();
    } else if (viewName === "spare-parts") {
        homeLayout.style.display = "none";
        sparePartsSection.classList.add("active");
        prefillSparePartsFormFromProfile();
        renderSparePartsList();
    } else if (viewName === "favorites") {
        homeLayout.style.display = "block";
        renderFavorites();
    } else if (viewName === "profile") {
        homeLayout.style.display = "none";
        profileSection.classList.add("active");
        renderProfileView();
    } else if (viewName === "info") {
        homeLayout.style.display = "none";
        infoSection.classList.add("active");
    } else if (viewName === "login") {
        homeLayout.style.display = "none";
        if (loginSection) loginSection.classList.add("active");
        // default to sign-in tab
        switchLoginTab("signin");
        const err = document.getElementById("login-error");
        if (err) err.textContent = "";
    } else if (viewName === "announcements") {
        homeLayout.style.display = "none";
        if (announcementsSection) announcementsSection.classList.add("active");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function openInfoTab(tabName = "safe-buying") {
    switchView("info");

    document.querySelectorAll("[data-info-tab]").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-info-tab") === tabName);
    });

    document.querySelectorAll(".info-tab-panel").forEach(panel => {
        panel.classList.toggle("active", panel.id === `info-panel-${tabName}`);
    });
}

// Login page tab switcher
function switchLoginTab(tab) {
    const signinTab = document.getElementById("tab-signin");
    const registerTab = document.getElementById("tab-register");
    const verifyTab = document.getElementById("tab-register-verify");

    const indicator = document.getElementById("login-tab-indicator");
    const signinForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const verifyForm = document.getElementById("register-verify-form");

    if (tab === "register") {
        signinTab?.classList.remove("active");
        registerTab?.classList.add("active");
        verifyTab?.classList.remove("active");
        indicator?.classList.add("on-register");
        signinForm?.classList.remove("active");
        registerForm?.classList.add("active");
        verifyForm?.classList.remove("active");
    } else if (tab === "register-verify") {
        signinTab?.classList.remove("active");
        registerTab?.classList.remove("active");
        verifyTab?.classList.add("active");
        indicator?.classList.add("on-register");
        signinForm?.classList.remove("active");
        registerForm?.classList.remove("active");
        verifyForm?.classList.add("active");
    } else {
        verifyTab?.classList.remove("active");
        registerTab?.classList.remove("active");
        signinTab?.classList.add("active");
        indicator?.classList.remove("on-register");
        registerForm?.classList.remove("active");
        verifyForm?.classList.remove("active");
        signinForm?.classList.add("active");
    }
}

async function handleLogin() {
    const email = document.getElementById("login-email")?.value.trim();
    const password = document.getElementById("login-password")?.value;
    const errorEl = document.getElementById("login-error");
    if (errorEl) errorEl.textContent = "";

    if (!email || !password) {
        if (errorEl) errorEl.textContent = "Email and password are required.";
        return;
    }

    const btn = document.getElementById("btn-login-submit");
    if (btn) { btn.disabled = true; const s = btn.querySelector("span"); if (s) s.textContent = "Signing in…"; }

    const { response, data } = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });

    if (btn) { btn.disabled = false; const s = btn.querySelector("span"); if (s) s.textContent = "Sign In"; }

    if (!response.ok) {
        // If the account exists but isn't verified, let them verify instead of just erroring
        if (response.status === 403 && data?.error?.toLowerCase().includes('verification')) {
            // Re-register with same credentials to get a fresh OTP
            const { response: regRes, data: regData } = await apiFetch("/api/auth/register", {
                method: "POST",
                body: JSON.stringify({ name: email.split("@")[0], email, password }),
            });
            if (regRes.ok && regData?.verificationRequired) {
                const tokenInput = document.getElementById("register-verification-token");
                if (tokenInput) tokenInput.value = regData.verificationToken;
                const codeInput = document.getElementById("register-otp");
                if (codeInput) codeInput.value = "";
                const otpHint = document.getElementById("register-otp-hint");
                if (otpHint) {
                    otpHint.style.display = regData.otpCode ? "block" : "none";
                    if (regData.otpCode) otpHint.textContent = `Your verification code (dev): ${regData.otpCode}`;
                }
                switchLoginTab("register-verify");
                return;
            }
        }
        if (errorEl) errorEl.textContent = data?.error || "Invalid credentials.";
        return;
    }

    setAccessToken(data.accessToken);
    currentUser = data.user;
    updateAuthUI();
    const dest = pendingRedirectView || "home";
    pendingRedirectView = null;
    switchView(dest);
}

async function handleRegister() {
    const name = document.getElementById("register-name")?.value.trim();
    const email = document.getElementById("register-email")?.value.trim();
    const password = document.getElementById("register-password")?.value;
    const errorEl = document.getElementById("register-error");
    if (errorEl) errorEl.textContent = "";

    if (!name || !email || !password) {
        if (errorEl) errorEl.textContent = "All fields are required.";
        return;
    }
    if (password.length < 8) {
        if (errorEl) errorEl.textContent = "Password must be at least 8 characters.";
        return;
    }

    const btn = document.getElementById("btn-register-submit");
    if (btn) { btn.disabled = true; const s = btn.querySelector("span"); if (s) s.textContent = "Creating…"; }

    const { response, data } = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
    });

    if (btn) { btn.disabled = false; const s = btn.querySelector("span"); if (s) s.textContent = "Create Account"; }

    if (!response.ok) {
        if (errorEl) errorEl.textContent = data?.error || "Registration failed.";
        return;
    }

    // 2-step verification gate
    if (data?.verificationRequired) {
        const vt = data.verificationToken;
        if (!vt) {
            if (errorEl) errorEl.textContent = "Verification failed to start.";
            return;
        }

        // In dev mode server returns otpCode (TEMP). Prefer not to display in production.
        const otpCode = data.otpCode;

        const codeInput = document.getElementById("register-otp");
        if (codeInput) codeInput.value = "";

        const tokenInput = document.getElementById("register-verification-token");
        if (tokenInput) tokenInput.value = vt;

        const otpHint = document.getElementById("register-otp-hint");
        if (otpHint) {
            otpHint.style.display = otpCode ? "block" : "none";
            if (otpCode) otpHint.textContent = `Your verification code (dev): ${otpCode}`;
        }

        // Switch UI to OTP verification panel
        switchLoginTab("register-verify");
        // Preserve the original redirect destination through the verify step
        if (!pendingRedirectView || pendingRedirectView === "login") {
            pendingRedirectView = "home";
        }
        return;
    }

    // Backward compatibility (if server still returns tokens)
    if (data?.accessToken && data?.user) {
        setAccessToken(data.accessToken);
        currentUser = data.user;
        updateAuthUI();
        const dest = pendingRedirectView || "home";
        pendingRedirectView = null;
        switchView(dest);
    }
}

async function handleLogout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setAccessToken("");
    currentUser = null;
    updateAuthUI();
    switchView("home");
}

async function handleVerifyRegistration() {
    const errorEl = document.getElementById("register-verify-error");
    if (errorEl) errorEl.textContent = "";

    const verificationToken = document.getElementById("register-verification-token")?.value?.trim();
    const otp = document.getElementById("register-otp")?.value?.trim();

    if (!verificationToken || !otp) {
        if (errorEl) errorEl.textContent = "Verification token and OTP are required.";
        return;
    }

    const btn = document.getElementById("btn-register-verify-submit");
    if (btn) { btn.disabled = true; const s = btn.querySelector("span"); if (s) s.textContent = "Verifying…"; }

    const { response, data } = await apiFetch("/api/auth/verify-registration", {
        method: "POST",
        body: JSON.stringify({ verificationToken, otp }),
    });

    if (btn) { btn.disabled = false; const s = btn.querySelector("span"); if (s) s.textContent = "Verify & Continue"; }

    if (!response.ok) {
        if (errorEl) errorEl.textContent = data?.error || "Verification failed.";
        return;
    }

    if (data?.accessToken && data?.user) {
        setAccessToken(data.accessToken);
        currentUser = data.user;
        updateAuthUI();
        const dest = pendingRedirectView || "home";
        pendingRedirectView = null;
        switchView(dest);
        return;
    }

    if (errorEl) errorEl.textContent = "Unexpected verification response.";
}

async function handleResendOtp() {
    const errorEl = document.getElementById("register-verify-error");
    if (errorEl) errorEl.textContent = "";

    const verificationToken = document.getElementById("register-verification-token")?.value?.trim();
    if (!verificationToken) {
        if (errorEl) errorEl.textContent = "Session expired. Please go back and register again.";
        return;
    }

    const resendLink = document.getElementById("btn-resend-otp");
    if (resendLink) { resendLink.style.pointerEvents = "none"; resendLink.textContent = "Sending…"; }

    const { response, data } = await apiFetch("/api/auth/resend-otp", {
        method: "POST",
        body: JSON.stringify({ verificationToken }),
    });

    if (resendLink) { resendLink.style.pointerEvents = ""; resendLink.textContent = "Resend code"; }

    if (!response.ok) {
        if (errorEl) errorEl.textContent = data?.error || "Failed to resend code.";
        return;
    }

    // Update the stored token (fresh JWT) and show new code hint if available
    if (data.verificationToken) {
        const tokenInput = document.getElementById("register-verification-token");
        if (tokenInput) tokenInput.value = data.verificationToken;
    }
    const codeInput = document.getElementById("register-otp");
    if (codeInput) codeInput.value = "";
    const otpHint = document.getElementById("register-otp-hint");
    if (otpHint) {
        otpHint.style.display = data.otpCode ? "block" : "none";
        if (data.otpCode) otpHint.textContent = `Your verification code (dev): ${data.otpCode}`;
    }
    if (errorEl) { errorEl.style.color = "var(--accent-cyan)"; errorEl.textContent = "A new code has been sent."; }
}

// ── Google OAuth (popup flow via google_oauth.html) ────────────
function handleGoogleLogin() {
    const w = 480, h = 580;
    const left = Math.round(screen.width / 2 - w / 2);
    const top  = Math.round(screen.height / 2 - h / 2);
    window.open(
        "google_oauth.html",
        "google_oauth",
        `width=${w},height=${h},top=${top},left=${left},resizable=no,scrollbars=no`
    );
}

async function handleGoogleAuthSuccess({ name, email }) {
    if (!name || !email) return;

    const errorEl = document.getElementById("login-error");
    if (errorEl) errorEl.textContent = "";

    // Use the dedicated oauth-login endpoint which upserts the user
    const { response, data } = await apiFetch("/api/auth/oauth-login", {
        method: "POST",
        body: JSON.stringify({ name, email, provider: "google" }),
    });

    if (!response.ok) {
        if (errorEl) errorEl.textContent = data?.error || "Google sign-in failed.";
        return;
    }

    setAccessToken(data.accessToken);
    currentUser = data.user;
    updateAuthUI();
    showToast(`Welcome, ${currentUser.name || name}!`, "success");
    const dest = pendingRedirectView || "home";
    pendingRedirectView = null;
    switchView(dest);
}

// ── Toast notification ─────────────────────────────────────────
function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `app-toast app-toast-${type}`;
    toast.innerHTML = `<i class="fas ${type === "success" ? "fa-check-circle" : type === "error" ? "fa-exclamation-circle" : "fa-info-circle"}"></i> ${message}`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("app-toast-show"));
    setTimeout(() => {
        toast.classList.remove("app-toast-show");
        toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    }, 3800);
}

function handleSparePartFiles(files) {
    const maxFiles = 10;
    const maxSize = 5 * 1024 * 1024;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const previewContainer = document.getElementById("spare-upload-previews");
    if (!previewContainer) return;

    for (let i = 0; i < files.length; i++) {
        if (sparePartUploadedImages.length >= maxFiles) {
            alert("Maximum 10 images allowed.");
            break;
        }

        const file = files[i];
        if (!allowed.includes(file.type)) {
            alert(`${file.name}: Only JPEG, PNG, and WebP are allowed.`);
            continue;
        }
        if (file.size > maxSize) {
            alert(`${file.name}: Maximum file size is 5 MB.`);
            continue;
        }

        sparePartUploadedImages.push(file);

        const idx = sparePartUploadedImages.length - 1;
        const reader = new FileReader();
        reader.onload = (e) => {
            const thumb = document.createElement("div");
            thumb.className = "preview-thumb-wrapper";
            thumb.setAttribute("data-spare-idx", idx);
            thumb.innerHTML = `
                <img src="${e.target.result}" alt="Spare part preview">
                <button type="button" class="preview-remove-btn" onclick="removeSparePartImage(${idx})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            previewContainer.appendChild(thumb);
        };
        reader.readAsDataURL(file);
    }
}

function removeSparePartImage(idx) {
    sparePartUploadedImages.splice(idx, 1);
    const previewContainer = document.getElementById("spare-upload-previews");
    if (!previewContainer) return;
    previewContainer.innerHTML = "";
    sparePartUploadedImages.forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const thumb = document.createElement("div");
            thumb.className = "preview-thumb-wrapper";
            thumb.innerHTML = `
                <img src="${e.target.result}" alt="Spare part preview">
                <button type="button" class="preview-remove-btn" onclick="removeSparePartImage(${i})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            previewContainer.appendChild(thumb);
        };
        reader.readAsDataURL(file);
    });
}

// Prefill ad upload sheet with current user profile
function prefillPostAdFormFromProfile() {
    const nameField = document.getElementById("ad-seller-name");
    const phoneField = document.getElementById("ad-seller-phone");
    const emailField = document.getElementById("ad-seller-email");
    const locField = document.getElementById("ad-seller-location");

    const name = currentUser?.name || profile.name;
    const email = currentUser?.email || profile.email;

    if (nameField && name) nameField.value = name;
    if (phoneField && profile.phone) phoneField.value = profile.phone;
    if (emailField && email) emailField.value = email;
    if (locField && profile.location) syncCustomDropdown("ad-seller-location", profile.location);
}

function prefillSparePartsFormFromProfile() {
    const nameField = document.getElementById("spare-seller-name");
    const phoneField = document.getElementById("spare-seller-phone");
    const locationField = document.getElementById("spare-location");

    const name = currentUser?.name || profile.name;
    if (nameField && name) nameField.value = name;
    if (phoneField && profile.phone) phoneField.value = profile.phone;
    if (locationField && profile.location) {
        syncCustomDropdown("spare-location", profile.location);
    }
}

async function submitSparePart() {
    const form = document.getElementById("spare-parts-form");
    if (!form) return;

    const requiredFields = form.querySelectorAll("[required]");
    let isValid = true;
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.style.borderColor = "#ef4444";
            isValid = false;
            field.addEventListener("input", function resetBorder() {
                field.style.borderColor = "";
                field.removeEventListener("input", resetBorder);
            });
        }
    });

    if (sparePartUploadedImages.length === 0) {
        alert("Please upload at least one image (max 10, 5 MB each).");
        return;
    }

    if (!isValid) {
        alert("Please fill all required spare part details.");
        return;
    }

    let imageUrls = [];
    try {
        imageUrls = await uploadImagesToCloud(sparePartUploadedImages);
    } catch (err) {
        alert(err.message || "Failed to upload images.");
        return;
    }

    const payload = {
        name: document.getElementById("spare-part-name").value.trim(),
        category: document.getElementById("spare-part-category").value,
        compatible: document.getElementById("spare-compatible").value.trim(),
        condition: document.getElementById("spare-condition").value,
        price: parseInt(document.getElementById("spare-price").value, 10) || 0,
        location: document.getElementById("spare-location").value,
        sellerName: document.getElementById("spare-seller-name").value.trim(),
        sellerPhone: document.getElementById("spare-seller-phone").value.trim(),
        description: document.getElementById("spare-description").value.trim(),
        images: imageUrls,
    };

    const { response, data } = await apiFetch("/api/spare-parts", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        alert(data?.error || "Failed to submit spare part.");
        return;
    }

    await fetchSparePartsFromServer();
    resetSparePartsForm();
    renderSparePartsList();
    renderSidebarCounts();
    alert("Spare part listed successfully.");
}

function resetSparePartsForm() {
    const form = document.getElementById("spare-parts-form");
    if (form) form.reset();

    sparePartUploadedImages = [];
    const previewContainer = document.getElementById("spare-upload-previews");
    if (previewContainer) previewContainer.innerHTML = "";

    syncCustomDropdown("spare-part-category", "Performance");
    syncCustomDropdown("spare-condition", "Brand New");
    syncCustomDropdown("spare-location", profile.location || "Colombo");
    prefillSparePartsFormFromProfile();
}

function renderSparePartsList() {
    const container = document.getElementById("spare-parts-list");
    if (!container) return;

    if (spareParts.length === 0) {
        container.innerHTML = `
            <div class="listings-empty-state">
                <i class="fas fa-cogs empty-state-icon"></i>
                <div class="empty-state-title">No Spare Parts Submitted Yet</div>
                <div class="empty-state-desc">Use the form to add performance parts, accessories, or service items.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = spareParts.map(part => {
        const thumb = part.images && part.images[0]
            ? `<img src="${part.images[0]}" alt="${part.name}" class="spare-part-thumb">`
            : "";
        const isOwner = currentUser && part.publisherId === currentUser.id;
        const deleteBtn = isOwner
            ? `<button type="button" class="btn-my-ad-action btn-delete" onclick="deleteSparePartListing('${part.id}')"><i class="fas fa-trash-alt"></i> Delete</button>`
            : "";

        return `
        <article class="spare-part-card ${thumb ? "spare-part-card-with-img" : ""}">
            ${thumb}
            <div>
                <div class="spare-part-title">${part.name}</div>
                <div class="spare-part-meta">
                    <span><i class="fas fa-tag"></i> ${part.category}</span>
                    <span><i class="fas fa-car-side"></i> ${part.compatible}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${part.location}</span>
                </div>
                <p>${part.description}</p>
            </div>
            <div class="spare-part-side spare-part-actions">
                <span class="spare-part-condition">${part.condition}</span>
                <strong>${formatPriceLKR(part.price)}</strong>
                <a href="tel:${part.sellerPhone}" class="btn-my-ad-action">
                    <i class="fas fa-phone"></i> Contact
                </a>
                ${deleteBtn}
            </div>
        </article>
    `;
    }).join("");
}

async function deleteSparePartListing(id) {
    showDeleteConfirmModal(
        "Are you sure you want to remove this listing? This action cannot be undone.",
        async () => {
            const { response, data } = await apiFetch(`/api/spare-parts/${id}`, { method: "DELETE" });
            if (!response.ok) {
                alert(data?.error || "Failed to delete listing.");
                return;
            }
            await fetchSparePartsFromServer();
            renderSparePartsList();
            renderMySparePartsList();
            renderSidebarCounts();
        }
    );
}

// Render User Profile page parameters
function renderProfileView() {
    // 1. Profile Left Card details
    document.getElementById("profile-card-name").innerText = profile.name;
    document.getElementById("profile-card-bio").innerText = profile.bio || "No bio added yet.";

    const avatarContainer = document.getElementById("profile-card-avatar-container");
    if (avatarContainer) {
        avatarContainer.innerHTML = profile.avatar
            ? `<img src="${profile.avatar}" alt="${profile.name}">`
            : `<i class="fas fa-user-circle"></i>`;
    }

    // Stats calculations
    const myAdsCount = ads.filter(a => a.id.includes("custom") || a.sellerPhone === profile.phone).length;
    document.getElementById("profile-stat-listings").innerText = myAdsCount;
    document.getElementById("profile-stat-favorites").innerText = favorites.length;

    // 2. Edit Profile fields
    document.getElementById("prof-name").value = profile.name;
    document.getElementById("prof-phone").value = profile.phone;
    document.getElementById("prof-email").value = profile.email;
    document.getElementById("prof-location").value = profile.location;
    document.getElementById("prof-bio").value = profile.bio;
    profilePhotoDraft = "";
    setProfilePhotoPreview(profile.avatar);

    // 3. Render Listings posted by user
    renderMyAdsList();
    renderMySparePartsList();
}

// Render My Listings sub-tab in Profile page
function renderMyAdsList() {
    const container = document.getElementById("my-ads-container-list");
    if (!container) return;

    container.innerHTML = "";
    const myAds = ads.filter(a => {
        if (currentUser && a.publisherId) return a.publisherId === currentUser.id;
        return a.id.includes("custom") || a.sellerPhone === profile.phone;
    });

    if (myAds.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px 10px; color: var(--text-secondary)">
                <i class="fas fa-car-side" style="font-size:2.5rem; margin-bottom:12px; color:var(--text-muted)"></i>
                <p>You have not posted any premium vehicle ads yet.</p>
                <button type="button" class="btn-post" style="margin: 15px auto 0; padding:8px 18px" onclick="switchView('post-ad')">Post Ad</button>
            </div>
        `;
        return;
    }

    myAds.forEach(ad => {
        const card = document.createElement("div");
        card.className = "my-ad-card";
        card.innerHTML = `
            <img src="${ad.images[0]}" alt="${ad.title}" class="my-ad-img">
            <div class="my-ad-info">
                <div class="my-ad-title">${ad.title}</div>
                <div class="my-ad-price">${formatPriceLKR(ad.price)}</div>
            </div>
            <div class="my-ad-actions">
                <button type="button" class="btn-my-ad-action" onclick="openDetailsModal('${ad.id}')"><i class="fas fa-eye"></i> View</button>
                <button type="button" class="btn-my-ad-action btn-delete" onclick="deleteMyAd(event, '${ad.id}')"><i class="fas fa-trash-alt"></i> Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderMySparePartsList() {
    const container = document.getElementById("my-spare-parts-container-list");
    if (!container) return;

    container.innerHTML = "";
    if (!currentUser) {
        container.innerHTML = `<p style="color:var(--text-secondary); padding:16px 0">Login to manage your spare parts listings.</p>`;
        return;
    }

    const myParts = spareParts.filter(p => p.publisherId === currentUser.id);

    if (myParts.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 24px 10px; color: var(--text-secondary)">
                <i class="fas fa-cogs" style="font-size:2rem; margin-bottom:10px; color:var(--text-muted)"></i>
                <p>No spare parts listings yet.</p>
                <button type="button" class="btn-post" style="margin: 12px auto 0; padding:8px 18px" onclick="switchView('spare-parts')">List Spare Part</button>
            </div>
        `;
        return;
    }

    myParts.forEach(part => {
        const card = document.createElement("div");
        card.className = "my-ad-card";
        const img = part.images && part.images[0] ? part.images[0] : "";
        card.innerHTML = `
            ${img ? `<img src="${img}" alt="${part.name}" class="my-ad-img">` : `<div class="my-ad-img" style="display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary)"><i class="fas fa-cogs"></i></div>`}
            <div class="my-ad-info">
                <div class="my-ad-title">${part.name}</div>
                <div class="my-ad-price">${formatPriceLKR(part.price)}</div>
            </div>
            <div class="my-ad-actions">
                <button type="button" class="btn-my-ad-action btn-delete" onclick="deleteSparePartListing('${part.id}')"><i class="fas fa-trash-alt"></i> Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// Delete user ad
function deleteMyAd(event, id) {
    event.stopPropagation();

    showDeleteConfirmModal(
        "Are you sure you want to remove this listing? This action cannot be undone.",
        async () => {
            const ad = ads.find(a => a.id === id);
            if (!ad) return;

            if (currentUser && ad.publisherId) {
                const { response, data } = await apiFetch(`/api/ads/${id}`, { method: "DELETE" });
                if (!response.ok) {
                    alert(data?.error || "Failed to delete listing.");
                    return;
                }
            } else {
                const idx = ads.findIndex(a => a.id === id);
                if (idx > -1) ads.splice(idx, 1);
                localStorage.setItem("ceylonsuper_ads", JSON.stringify(ads));
            }

            await fetchAdsFromServer();
            renderProfileView();
            renderSidebarCounts();
            renderListings();
        }
    );
}

// Save User Profile detail parameters
function saveUserProfile() {
    const name = document.getElementById("prof-name").value.trim();
    const phone = document.getElementById("prof-phone").value.trim();
    const email = document.getElementById("prof-email").value.trim();
    const location = document.getElementById("prof-location").value;
    const bio = document.getElementById("prof-bio").value.trim();

    if (!name || !phone || !email) {
        alert("Name, Phone, and Email are required fields.");
        return;
    }

    const avatar = profilePhotoDraft || profile.avatar || "";

    profile = { name, phone, email, location, bio, avatar };
    localStorage.setItem("ceylonsuper_profile", JSON.stringify(profile));

    renderProfileView();
    alert("Profile saved successfully!");
}

function handleProfilePhotoFile(file) {
    if (!file.type.match("image.*")) {
        alert("Please choose a valid image file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        profilePhotoDraft = event.target.result;
        setProfilePhotoPreview(profilePhotoDraft);
    };
    reader.readAsDataURL(file);
}

function setProfilePhotoPreview(src) {
    const preview = document.getElementById("profile-photo-preview");
    if (!preview) return;

    preview.innerHTML = src
        ? `<img src="${src}" alt="Profile photo preview">`
        : `<i class="fas fa-user-circle"></i>`;
}

// Sidebar quick counts renderer
function renderSidebarCounts() {
    // Categories count
    const totalSupercars = ads.filter(a => a.type === "supercar").length;
    const totalSuperbikes = ads.filter(a => a.type === "superbike").length;

    const countSupercars = document.getElementById("count-supercars");
    const countSuperbikes = document.getElementById("count-superbikes");
    if (countSupercars) countSupercars.innerText = totalSupercars;
    if (countSuperbikes) countSuperbikes.innerText = totalSuperbikes;

    // Location counts
    const locations = ["Colombo", "Gampaha", "Kandy", "Galle", "Kurunegala", "Negombo"];
    locations.forEach(loc => {
        const countEl = document.getElementById(`count-loc-${loc.toLowerCase()}`);
        if (countEl) {
            countEl.innerText = ads.filter(a => a.location.toLowerCase() === loc.toLowerCase()).length;
        }
    });
}

// Quick filter via sidebar links
function filterBySidebar(key, value) {
    resetFilters();
    if (key === "type") {
        currentFilters.type = value;
        syncCustomDropdown("filter-type", value);
        // Sync tabs
        document.querySelectorAll(".quick-type-tabs .tab-btn").forEach(b => {
            b.classList.remove("active");
            if (b.getAttribute("data-type") === value) b.classList.add("active");
        });
    } else if (key === "location") {
        currentFilters.location = value;
        syncCustomDropdown("filter-location", value);
    }

    // Ensure active view is home
    const homeLayout = document.getElementById("home-layout-section");
    const postAdSection = document.getElementById("post-ad-section");
    const sparePartsSection = document.getElementById("spare-parts-section");
    const infoSection = document.getElementById("info-section");
    const profileSection = document.getElementById("profile-section");
    homeLayout.style.display = "block";
    postAdSection.classList.remove("active");
    sparePartsSection.classList.remove("active");
    infoSection.classList.remove("active");
    profileSection.classList.remove("active");
    document.querySelectorAll("[data-target-view]").forEach(link => {
        link.classList.toggle("active", link.getAttribute("data-target-view") === "home");
    });

    renderListings();
    window.scrollTo({ top: 400, behavior: "smooth" });
}

// Update filter object from Search Console form
function updateFiltersFromForm() {
    currentFilters.type = document.getElementById("filter-type").value;
    currentFilters.make = document.getElementById("filter-make").value;
    currentFilters.location = document.getElementById("filter-location").value;
    currentFilters.priceMin = document.getElementById("filter-price-min").value;
    currentFilters.priceMax = document.getElementById("filter-price-max").value;
    currentFilters.yearMin = document.getElementById("filter-year-min").value;
    currentFilters.yearMax = document.getElementById("filter-year-max").value;
    currentFilters.keyword = document.getElementById("filter-keyword").value;

    // Update active tabs
    document.querySelectorAll(".quick-type-tabs .tab-btn").forEach(b => {
        b.classList.remove("active");
        if (b.getAttribute("data-type") === currentFilters.type) b.classList.add("active");
    });
}

// Reset filters
function resetFilters() {
    currentFilters = {
        type: "all",
        make: "all",
        location: "all",
        priceMin: "",
        priceMax: "",
        yearMin: "",
        yearMax: "",
        transmission: "all",
        condition: "all",
        keyword: ""
    };

    // Reset inputs
    document.getElementById("filter-type").value = "all";
    document.getElementById("filter-make").value = "all";
    document.getElementById("filter-location").value = "all";
    document.getElementById("filter-price-min").value = "";
    document.getElementById("filter-price-max").value = "";
    document.getElementById("filter-year-min").value = "";
    document.getElementById("filter-year-max").value = "";
    document.getElementById("filter-keyword").value = "";
    syncCustomDropdown("filter-type", "all");
    syncCustomDropdown("filter-make", "all");
    syncCustomDropdown("filter-location", "all");

    // Sync tabs
    document.querySelectorAll(".quick-type-tabs .tab-btn").forEach(b => {
        b.classList.remove("active");
        if (b.getAttribute("data-type") === "all") b.classList.add("active");
    });

    renderListings();
}

// Format LKR prices nicely
function formatPriceLKR(price) {
    if (price >= 10000000) {
        return "LKR " + (price / 10000000).toFixed(2) + " Crore";
    }
    return "LKR " + price.toLocaleString("en-LK");
}

// Display only LKR (removed USD conversion)
function formatPriceUSD(_priceLkr) {
    return "";
}

// Swap Ceylon Force logo based on theme
function setCeylonForceLogoForCurrentTheme() {
    const img = document.querySelector("img.hero-logo");
    if (!img) return;

    const isLight = document.body.classList.contains("theme-light");
    img.src = isLight ? "images/Ceylon Force (black).png" : "images/Ceylon Force (white).png";
}


// Render vehicle listings grid/list
function renderListings() {
    const listContainer = document.getElementById("listings-container");
    if (!listContainer) return;

    listContainer.innerHTML = "";

    // Apply Filtering
    let filtered = ads.filter(ad => {
        // Type filter
        if (currentFilters.type !== "all" && ad.type !== currentFilters.type) return false;

        // Make filter
        if (currentFilters.make !== "all" && ad.make.toLowerCase() !== currentFilters.make.toLowerCase()) return false;

        // Location filter
        if (currentFilters.location !== "all" && ad.location.toLowerCase() !== currentFilters.location.toLowerCase()) return false;

        // Price filters
        if (currentFilters.priceMin && ad.price < parseInt(currentFilters.priceMin)) return false;
        if (currentFilters.priceMax && ad.price > parseInt(currentFilters.priceMax)) return false;

        // Year filters
        if (currentFilters.yearMin && ad.year < parseInt(currentFilters.yearMin)) return false;
        if (currentFilters.yearMax && ad.year > parseInt(currentFilters.yearMax)) return false;

        // Text keyword search
        if (currentFilters.keyword) {
            const query = currentFilters.keyword.toLowerCase();
            const matchesTitle = ad.title.toLowerCase().includes(query);
            const matchesModel = ad.model.toLowerCase().includes(query);
            const matchesMake = ad.make.toLowerCase().includes(query);
            const matchesDesc = ad.description.toLowerCase().includes(query);
            if (!matchesTitle && !matchesModel && !matchesMake && !matchesDesc) return false;
        }

        return true;
    });

    // Apply Sorting
    const sortVal = document.getElementById("sort-select") ? document.getElementById("sort-select").value : "recent";
    if (sortVal === "price-asc") {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sortVal === "price-desc") {
        filtered.sort((a, b) => b.price - a.price);
    } else if (sortVal === "year-desc") {
        filtered.sort((a, b) => b.year - a.year);
    } else if (sortVal === "mileage-asc") {
        filtered.sort((a, b) => a.mileage - b.mileage);
    } else {
        // default recent
        filtered.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    }

    // Set layout view mode
    const gridClass = viewMode === "grid" ? "grid-view" : "list-view";
    listContainer.className = `listings-grid ${gridClass}`;

    // Update results counter
    const countSpan = document.getElementById("results-count-number");
    if (countSpan) countSpan.innerText = filtered.length;

    // Check if empty
    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="listings-empty-state form-input-full">
                <i class="fas fa-car-crash empty-state-icon"></i>
                <div class="empty-state-title">No Matching Vehicles Found</div>
                <div class="empty-state-desc">Try resetting your filters or adjusting your price and year search parameters.</div>
                <button class="btn-reset" onclick="resetFilters()">Reset Filters</button>
            </div>
        `;
        return;
    }

    // Render Cards
    filtered.forEach(ad => {
        const isFav = favorites.includes(ad.id);
        const cardEl = document.createElement("div");
        cardEl.className = `listing-card ${ad.featured ? 'featured-card' : ''}`;
        cardEl.setAttribute("data-id", ad.id);

        const cardHtml = `
            <div class="card-inner-flex">
                <div class="card-img-wrapper" onclick="openDetailsModal('${ad.id}')">
                    <img class="card-img" src="${ad.images[0]}" alt="${ad.title}" loading="lazy">
                </div>
                <button class="card-fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, '${ad.id}')" title="${isFav ? 'Remove from Watchlist' : 'Add to Watchlist'}">
                    <i class="fa${isFav ? 's' : 'r'} fa-heart"></i>
                </button>
                <div class="card-info">
                    <div>
                        <div class="card-header-row">
                            <h3 class="card-title" onclick="openDetailsModal('${ad.id}')" style="cursor:pointer">${ad.title}</h3>
                            <div class="card-price-container">
                                <div class="card-price-lkr">${formatPriceLKR(ad.price)}</div>
                                <div class="card-price-usd">${formatPriceUSD(ad.price)}</div>
                            </div>
                        </div>
                        <div class="card-meta-line">
                            <div class="card-meta-item"><i class="fas fa-map-marker-alt"></i> ${ad.location}</div>
                            <div class="card-meta-item"><i class="far fa-calendar-alt"></i> ${ad.year}</div>
                            <div class="card-meta-item"><i class="fas fa-tachometer-alt"></i> ${ad.mileage.toLocaleString()} km</div>
                            <div class="card-meta-item"><span class="badge ${ad.type === 'supercar' ? 'badge-orange' : 'badge-cyan'}">${ad.type}</span></div>
                        </div>
                        <p class="card-description">${ad.description}</p>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px">
                        <div class="card-spec-badges">
                            <span class="card-spec-badge">${ad.engine}</span>
                            <span class="card-spec-badge">${ad.transmission}</span>
                            <span class="card-spec-badge">${ad.condition}</span>
                        </div>
                        <button class="btn-post" style="padding: 6px 14px; font-size: 0.8rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); box-shadow: none" onclick="openDetailsModal('${ad.id}')">View Details</button>
                    </div>
                </div>
            </div>
        `;
        cardEl.innerHTML = cardHtml;
        listContainer.appendChild(cardEl);
    });
}

// Render watchlisted items only
function renderFavorites() {
    const listContainer = document.getElementById("listings-container");
    if (!listContainer) return;

    listContainer.innerHTML = "";
    let filtered = ads.filter(ad => favorites.includes(ad.id));

    const countSpan = document.getElementById("results-count-number");
    if (countSpan) countSpan.innerText = filtered.length;

    const gridClass = viewMode === "grid" ? "grid-view" : "list-view";
    listContainer.className = `listings-grid ${gridClass}`;

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="listings-empty-state form-input-full">
                <i class="fas fa-heart-broken empty-state-icon" style="color:#ef4444"></i>
                <div class="empty-state-title">Your Watchlist is Empty</div>
                <div class="empty-state-desc">Click the heart icon on any supercar or superbike listing to save it here.</div>
                <button class="btn-search" onclick="switchView('home')">Browse Marketplace</button>
            </div>
        `;
        return;
    }

    filtered.forEach(ad => {
        const cardEl = document.createElement("div");
        cardEl.className = `listing-card ${ad.featured ? 'featured-card' : ''}`;
        cardEl.setAttribute("data-id", ad.id);

        const cardHtml = `
            <div class="card-inner-flex">
                <div class="card-img-wrapper" onclick="openDetailsModal('${ad.id}')">
                    <img class="card-img" src="${ad.images[0]}" alt="${ad.title}" loading="lazy">
                </div>
                <button class="card-fav-btn active" onclick="toggleFavorite(event, '${ad.id}')" title="Remove from Watchlist">
                    <i class="fas fa-heart"></i>
                </button>
                <div class="card-info">
                    <div>
                        <div class="card-header-row">
                            <h3 class="card-title" onclick="openDetailsModal('${ad.id}')" style="cursor:pointer">${ad.title}</h3>
                            <div class="card-price-container">
                                <div class="card-price-lkr">${formatPriceLKR(ad.price)}</div>
                                <div class="card-price-usd">${formatPriceUSD(ad.price)}</div>
                            </div>
                        </div>
                        <div class="card-meta-line">
                            <div class="card-meta-item"><i class="fas fa-map-marker-alt"></i> ${ad.location}</div>
                            <div class="card-meta-item"><i class="far fa-calendar-alt"></i> ${ad.year}</div>
                            <div class="card-meta-item"><i class="fas fa-tachometer-alt"></i> ${ad.mileage.toLocaleString()} km</div>
                            <div class="card-meta-item"><span class="badge ${ad.type === 'supercar' ? 'badge-orange' : 'badge-cyan'}">${ad.type}</span></div>
                        </div>
                        <p class="card-description">${ad.description}</p>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px">
                        <div class="card-spec-badges">
                            <span class="card-spec-badge">${ad.engine}</span>
                            <span class="card-spec-badge">${ad.transmission}</span>
                            <span class="card-spec-badge">${ad.condition}</span>
                        </div>
                        <button class="btn-post" style="padding: 6px 14px; font-size: 0.8rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); box-shadow: none" onclick="openDetailsModal('${ad.id}')">View Details</button>
                    </div>
                </div>
            </div>
        `;
        cardEl.innerHTML = cardHtml;
        listContainer.appendChild(cardEl);
    });
}

// Toggle Favorite status
function toggleFavorite(event, id) {
    event.stopPropagation();

    const index = favorites.indexOf(id);
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(id);
    }

    localStorage.setItem("ceylonsuper_favorites", JSON.stringify(favorites));
    updateFavBadge();

    const btn = event.currentTarget;
    if (btn) {
        btn.classList.toggle("active");
        const icon = btn.querySelector("i");
        if (icon) {
            icon.className = btn.classList.contains("active") ? "fas fa-heart" : "far fa-heart";
        }
    }

    // Refresh views if relevant
    const activeFavNavLink = document.querySelector(".nav-link[data-target-view='favorites']");
    if (activeFavNavLink && activeFavNavLink.classList.contains("active")) {
        renderFavorites();
    }
    const profileSection = document.getElementById("profile-section");
    if (profileSection && profileSection.classList.contains("active")) {
        renderProfileView();
    }
}

// Update watchlist counter in header
function updateFavBadge() {
    const badge = document.getElementById("watchlist-count-badge");
    if (badge) {
        badge.innerText = favorites.length;
        badge.style.display = favorites.length > 0 ? "flex" : "none";
    }
}

// Open detailed view modal
let activeDetailId = "";
function openDetailsModal(id) {
    const ad = ads.find(a => a.id === id);
    if (!ad) return;

    activeDetailId = id;
    const modal = document.getElementById("details-modal-container");
    const body = document.getElementById("details-modal-body");

    if (!modal || !body) return;

    let imageGalleryHtml = "";
    ad.images.forEach((img, index) => {
        imageGalleryHtml += `
            <div class="thumbnail-img ${index === 0 ? 'active' : ''}" onclick="changeDetailImage('${img}', this)">
                <img src="${img}" alt="${ad.title}">
            </div>
        `;
    });

    body.innerHTML = `
        <div class="details-gallery">
            <div class="main-image-container">
                <img id="detail-main-img" src="${ad.images[0]}" alt="${ad.title}">
            </div>
            <div class="thumbnails-container">
                ${imageGalleryHtml}
            </div>
        </div>
        <div class="details-content-grid">
            <div class="vehicle-desc-section">
                <span class="badge ${ad.type === 'supercar' ? 'badge-orange' : 'badge-cyan'}" style="font-size:0.8rem; margin-bottom:10px">${ad.type}</span>
                <h2>${ad.title}</h2>
                <div class="vehicle-spec-header-meta">
                    <div><i class="fas fa-map-marker-alt"></i> ${ad.location}</div>
                    <div><i class="far fa-clock"></i> Posted on ${ad.dateAdded}</div>
                    <div><i class="fas fa-eye"></i> 142 Views</div>
                </div>
                <div class="vehicle-description-text">${ad.description}</div>
                
                <div class="specs-table-wrapper">
                    <div class="specs-table-title">Full Vehicle Specifications</div>
                    <table class="specs-table">
                        <tr>
                            <td class="label-col">Make / Brand</td>
                            <td class="value-col">${ad.make}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Model</td>
                            <td class="value-col">${ad.model}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Year of Manufacture</td>
                            <td class="value-col">${ad.year}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Mileage</td>
                            <td class="value-col">${ad.mileage.toLocaleString()} km</td>
                        </tr>
                        <tr>
                            <td class="label-col">Condition</td>
                            <td class="value-col">${ad.condition}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Gearbox / Transmission</td>
                            <td class="value-col">${ad.transmission}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Fuel Type</td>
                            <td class="value-col">${ad.fuel}</td>
                        </tr>
                        <tr>
                            <td class="label-col">Engine Capacity</td>
                            <td class="value-col">${ad.engine}</td>
                        </tr>
                        ${ad.power ? `<tr><td class="label-col">Engine Power</td><td class="value-col">${ad.power}</td></tr>` : ''}
                        ${ad.topSpeed ? `<tr><td class="label-col">Top Speed</td><td class="value-col">${ad.topSpeed} km/h</td></tr>` : ''}
                        ${ad.zeroToHundred ? `<tr><td class="label-col">0 - 100 km/h</td><td class="value-col">${ad.zeroToHundred}</td></tr>` : ''}
                        <tr>
                            <td class="label-col">Duty Status</td>
                            <td class="value-col">${ad.dutyStatus}</td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <div>
                <div class="seller-card">
                    <div class="seller-price">${formatPriceLKR(ad.price)}</div>
                    <div class="seller-price-usd">Approx. ${formatPriceUSD(ad.price)}</div>
                    
                    <div class="seller-profile">
                        <div class="seller-avatar">
                            <i class="fas fa-user-tie"></i>
                        </div>
                        <div>
                            <div class="seller-name">
                                ${ad.sellerName} 
                                <i class="fas fa-check-circle" style="color:var(--accent-cyan); font-size:0.85rem" title="Verified Seller"></i>
                            </div>
                            <div class="seller-role">Verified CeylonSuper Agent</div>
                        </div>
                    </div>
                    
                    <button class="contact-action-btn btn-call" id="reveal-phone-btn" onclick="revealSellerPhone('${ad.sellerPhone}')">
                        <i class="fas fa-phone-alt"></i> Reveal Contact Number
                    </button>
                    

                    
                    <div class="safety-tips-box">
                        <h4><i class="fas fa-shield-alt"></i> Safety Warnings</h4>
                        <ul>
                            <li>Do not send advance payments before inspecting the vehicle in person.</li>
                            <li>Meet the seller in a secure public location.</li>
                            <li>Verify documentation, chassis number, and custom duty slips at the Department of Motor Traffic.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
}

// Change gallery main photo
function changeDetailImage(src, element) {
    document.getElementById("detail-main-img").src = src;
    document.querySelectorAll(".thumbnails-container .thumbnail-img").forEach(th => th.classList.remove("active"));
    element.classList.add("active");
}

// Reveal contact phone
function revealSellerPhone(phone) {
    const btn = document.getElementById("reveal-phone-btn");
    if (btn) {
        btn.innerHTML = `<i class="fas fa-phone-alt"></i> ${phone}`;
        btn.style.boxShadow = "var(--shadow-neon-cyan)";
        btn.style.background = "var(--accent-cyan-gradient)";
        btn.style.color = "#070809";
    }
}

// Chat simulator actions
let activeChatAgent = "";
let activeChatVehicle = "";
function openChatSimulator(agentName, vehicleTitle) {
    activeChatAgent = agentName;
    activeChatVehicle = vehicleTitle;

    const chatModal = document.getElementById("chat-simulator-modal");
    const chatHeaderName = document.getElementById("chat-agent-name");
    const chatMessages = document.getElementById("chat-messages-container");

    if (!chatModal || !chatHeaderName || !chatMessages) return;

    chatHeaderName.innerText = agentName;
    chatMessages.innerHTML = `
        <div class="chat-msg received">
            Hello! Thank you for inquiring about the <strong>${vehicleTitle}</strong> listed on CeylonSuper. How can I help you today?
        </div>
    `;

    chatModal.classList.add("active");
    document.getElementById("chat-input").focus();
}

function sendMessage() {
    const input = document.getElementById("chat-input");
    const messages = document.getElementById("chat-messages-container");

    if (!input || !messages || !input.value.trim()) return;

    const userText = input.value.trim();

    const userMsg = document.createElement("div");
    userMsg.className = "chat-msg sent";
    userMsg.innerText = userText;
    messages.appendChild(userMsg);

    input.value = "";
    messages.scrollTop = messages.scrollHeight;

    setTimeout(() => {
        const replyMsg = document.createElement("div");
        replyMsg.className = "chat-msg received";

        let replyText = `Thanks for your message! Yes, the ${activeChatVehicle} is currently available for viewing. Would you like to schedule an inspection at our secure showroom in Colombo?`;
        if (userText.toLowerCase().includes("price") || userText.toLowerCase().includes("last price") || userText.toLowerCase().includes("negotiable")) {
            replyText = "The price is slightly negotiable for serious buyers after physical inspection. We also offer premium leasing options starting from 14% interest rate.";
        } else if (userText.toLowerCase().includes("permit") || userText.toLowerCase().includes("duty")) {
            replyText = "Yes, all duty documents, custom clearing bills, and registration sheets are clean and available at our office for verification. We support duty-free permit holders as well.";
        }

        replyMsg.innerHTML = replyText;
        messages.appendChild(replyMsg);
        messages.scrollTop = messages.scrollHeight;
    }, 1500);
}

// Post Ad Step Controller
function goToStep(stepNum) {
    if (stepNum < 1 || stepNum > 4) return;

    activeStep = stepNum;

    document.querySelectorAll(".step-indicator").forEach((ind, index) => {
        ind.classList.remove("active", "completed");
        if (index + 1 < stepNum) {
            ind.classList.add("completed");
        } else if (index + 1 === stepNum) {
            ind.classList.add("active");
        }
    });

    document.querySelectorAll(".form-step-panel").forEach((panel, index) => {
        if (index + 1 === stepNum) {
            panel.classList.add("active");
        } else {
            panel.classList.remove("active");
        }
    });

    document.getElementById("post-ad-section").scrollIntoView({ behavior: "smooth" });
}

// Step fields validation
function validateStep(step) {
    let isValid = true;
    const currentPanel = document.querySelector(`.form-step-panel[data-step="${step}"]`);
    if (!currentPanel) return false;

    const requiredInputs = currentPanel.querySelectorAll("[required]");
    requiredInputs.forEach(input => {
        if (!input.value.trim() || input.value === "all") {
            isValid = false;
            input.style.borderColor = "#ef4444";

            input.addEventListener("input", function resetBorder() {
                input.style.borderColor = "";
                input.removeEventListener("input", resetBorder);
            });
        }
    });

    if (step === 2 && !validateEngineCapacity(true)) {
        isValid = false;
    }

    if (step === 3 && uploadedImages.length === 0) {
        const customUrlInput = document.getElementById("ad-unsplash-urls");
        if (!customUrlInput || !customUrlInput.value.trim()) {
            isValid = false;
            alert("Please upload at least 1 image or provide an Unsplash image URL.");
        }
    }

    return isValid;
}

// Handle image uploads
function handleUploadedFiles(files) {
    const previewContainer = document.getElementById("upload-previews-container");
    if (!previewContainer) return;

    const maxFiles = 10;
    const maxSize = 5 * 1024 * 1024;
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    for (let i = 0; i < files.length; i++) {
        if (uploadedImages.length >= maxFiles) {
            alert("Maximum 10 images allowed.");
            break;
        }

        const file = files[i];
        if (!allowed.includes(file.type)) continue;
        if (file.size > maxSize) {
            alert(`${file.name}: Maximum file size is 5 MB.`);
            continue;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            uploadedImages.push(base64);

            const idx = uploadedImages.length - 1;
            const thumb = document.createElement("div");
            thumb.className = "preview-thumb-wrapper";
            thumb.setAttribute("data-img-idx", idx);
            thumb.innerHTML = `
                <img src="${base64}" alt="Upload Preview">
                <button type="button" class="preview-remove-btn" onclick="removeUploadedImage(${idx})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            previewContainer.appendChild(thumb);
        };
        reader.readAsDataURL(file);
    }
}

function removeUploadedImage(idx) {
    uploadedImages.splice(idx, 1);

    const previewContainer = document.getElementById("upload-previews-container");
    if (!previewContainer) return;

    previewContainer.innerHTML = "";
    uploadedImages.forEach((img, i) => {
        const thumb = document.createElement("div");
        thumb.className = "preview-thumb-wrapper";
        thumb.setAttribute("data-img-idx", i);
        thumb.innerHTML = `
            <img src="${img}" alt="Upload Preview">
            <button type="button" class="preview-remove-btn" onclick="removeUploadedImage(${i})">
                <i class="fas fa-times"></i>
            </button>
        `;
        previewContainer.appendChild(thumb);
    });
}

// Submit the ad — creates draft then opens Stripe payment
async function submitNewAd() {
    if (!validateEngineCapacity(true)) {
        goToStep(2);
        return;
    }

    const type = document.getElementById("ad-type").value;
    const make = document.getElementById("ad-make").value;
    const model = document.getElementById("ad-model").value;
    const year = parseInt(document.getElementById("ad-year").value);
    const condition = document.getElementById("ad-condition").value;
    const dutyStatus = document.getElementById("ad-duty").value;

    const mileage = parseInt(document.getElementById("ad-mileage").value) || 0;
    const transmission = document.getElementById("ad-transmission").value;
    const fuel = document.getElementById("ad-fuel").value;
    const engine = document.getElementById("ad-engine").value;
    const engineCapacity = parseEngineCapacity(document.getElementById("ad-engine-capacity").value);
    const power = document.getElementById("ad-power").value || "";
    const topSpeed = parseInt(document.getElementById("ad-speed").value) || 299;
    const zeroToHundred = document.getElementById("ad-acceleration").value || "";

    const price = parseInt(document.getElementById("ad-price").value) || 0;
    const description = document.getElementById("ad-desc").value;

    const sellerName = document.getElementById("ad-seller-name").value;
    const sellerPhone = document.getElementById("ad-seller-phone").value;
    const sellerEmail = document.getElementById("ad-seller-email").value;
    const location = document.getElementById("ad-seller-location").value;

    let images = [];

    try {
        if (uploadedImages.length > 0) {
            images = await uploadImagesToCloud(uploadedImages);
        }
    } catch (err) {
        alert(err.message || "Failed to upload images to cloud storage.");
        return;
    }

    const customUrlInput = document.getElementById("ad-unsplash-urls");
    if (customUrlInput && customUrlInput.value.trim()) {
        const urls = customUrlInput.value.split(",").map(url => url.trim()).filter(url => url.length > 0);
        images = [...images, ...urls];
    }

    if (images.length === 0) {
        alert("Please upload at least one image or provide a web image URL.");
        return;
    }

    const payload = {
        type,
        make,
        model,
        year,
        price,
        location,
        mileage,
        transmission,
        fuel,
        engine,
        engineCapacity,
        power,
        topSpeed,
        zeroToHundred,
        condition,
        dutyStatus,
        sellerName,
        sellerPhone,
        sellerEmail,
        description,
        images,
    };

    const submitBtn = document.getElementById("btn-submit-ad");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
    }

    const { response, data } = await apiFetch("/api/ads", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Post Ad';
    }

    if (!response.ok) {
        alert(data?.error || "Failed to create ad.");
        return;
    }

    resetPostForm();
    await fetchAdsFromServer();
    renderSidebarCounts();
    renderListings();
    alert("Ad posted successfully.");
    switchView("home");
}


function resetPostForm() {
    document.getElementById("post-ad-form").reset();
    uploadedImages = [];
    const previewContainer = document.getElementById("upload-previews-container");
    if (previewContainer) previewContainer.innerHTML = "";
    const errorEl = document.getElementById("engine-capacity-error");
    if (errorEl) errorEl.style.display = "none";
    activeStep = 1;
    goToStep(1);
}

// Stripe payment UI removed (ads are posted immediately)
async function openPaymentModal(_ad) {
    // no-op
}


function closePaymentModal() {
    // no-op (Stripe UI removed)
}

async function confirmStripePayment() {
    // no-op (Stripe UI removed)
}


function syncCustomDropdown(dropdownId, value) {
    const hiddenInput = document.getElementById(dropdownId);
    const trigger = document.getElementById(dropdownId + "-trigger");
    const menu = document.getElementById(dropdownId + "-menu");
    if (!hiddenInput || !trigger || !menu) return;

    hiddenInput.value = value;
    const options = menu.querySelectorAll(".custom-dropdown-option");
    options.forEach(option => option.classList.remove("selected"));

    const selectedOption = Array.from(options).find(option => option.getAttribute("data-value") === value);
    if (selectedOption) {
        selectedOption.classList.add("selected");
        const triggerText = trigger.querySelector(".custom-dropdown-text");
        if (triggerText) triggerText.textContent = selectedOption.textContent;
    }
}

function initCustomDropdown(dropdownId, onSelectCallback) {
    const dropdown = document.getElementById(dropdownId + "-dropdown");
    const trigger = document.getElementById(dropdownId + "-trigger");
    const menu = document.getElementById(dropdownId + "-menu");
    const hiddenInput = document.getElementById(dropdownId);

    if (!dropdown || !trigger || !menu || !hiddenInput) return;

    let isOpen = false;

    // Toggle menu on trigger click
    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        isOpen = !isOpen;
        if (isOpen) {
            menu.classList.add("open");
            trigger.setAttribute("aria-expanded", "true");
        } else {
            menu.classList.remove("open");
            trigger.setAttribute("aria-expanded", "false");
        }
    });

    // Handle option selection
    const options = menu.querySelectorAll(".custom-dropdown-option");
    options.forEach(option => {
        option.addEventListener("click", (e) => {
            const value = option.getAttribute("data-value");
            const text = option.textContent;

            // Update hidden input
            hiddenInput.value = value;

            // Update trigger text
            const triggerText = trigger.querySelector(".custom-dropdown-text");
            triggerText.textContent = text;

            // Update selected state
            options.forEach(opt => opt.classList.remove("selected"));
            option.classList.add("selected");

            // Close menu
            menu.classList.remove("open");
            trigger.setAttribute("aria-expanded", "false");
            isOpen = false;

            // Trigger callback if provided
            if (onSelectCallback) onSelectCallback();
        });
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target) && isOpen) {
            menu.classList.remove("open");
            trigger.setAttribute("aria-expanded", "false");
            isOpen = false;
        }
    });

    // Keyboard navigation
    trigger.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            isOpen = !isOpen;
            if (isOpen) {
                menu.classList.add("open");
                trigger.setAttribute("aria-expanded", "true");
                options[0]?.focus();
            } else {
                menu.classList.remove("open");
                trigger.setAttribute("aria-expanded", "false");
            }
        } else if (e.key === "Escape" && isOpen) {
            menu.classList.remove("open");
            trigger.setAttribute("aria-expanded", "false");
            isOpen = false;
            trigger.focus();
        }
    });

    // Keyboard navigation within menu
    let currentIndex = -1;
    menu.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            currentIndex = Math.min(currentIndex + 1, options.length - 1);
            options[currentIndex]?.focus();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            currentIndex = Math.max(currentIndex - 1, 0);
            options[currentIndex]?.focus();
        } else if (e.key === "Enter") {
            e.preventDefault();
            options[currentIndex]?.click();
        } else if (e.key === "Escape") {
            menu.classList.remove("open");
            trigger.setAttribute("aria-expanded", "false");
            isOpen = false;
            trigger.focus();
        }
    });

    // Make options focusable
    options.forEach((option, index) => {
        option.setAttribute("tabindex", "0");
        option.addEventListener("focus", () => {
            currentIndex = index;
        });
        option.addEventListener("keydown", (e) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                currentIndex = Math.min(currentIndex + 1, options.length - 1);
                options[currentIndex]?.focus();
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                currentIndex = Math.max(currentIndex - 1, 0);
                options[currentIndex]?.focus();
            } else if (e.key === "Enter") {
                e.preventDefault();
                option.click();
            }
        });
    });

    // Set initial selected state
    const initialValue = hiddenInput.value;
    if (initialValue) {
        const selectedOption = Array.from(options).find(opt => opt.getAttribute("data-value") === initialValue);
        if (selectedOption) {
            selectedOption.classList.add("selected");
            trigger.querySelector(".custom-dropdown-text").textContent = selectedOption.textContent;
        }
    } else if (options.length > 0) {
        options[0]?.classList.add("selected");
    }
}

// Global functions attached to window for inline onclick execution
window.filterBySidebar = filterBySidebar;
window.resetFilters = resetFilters;
window.openDetailsModal = openDetailsModal;
window.changeDetailImage = changeDetailImage;
window.revealSellerPhone = revealSellerPhone;
window.openChatSimulator = openChatSimulator;
window.toggleFavorite = toggleFavorite;
window.switchView = switchView;
window.removeUploadedImage = removeUploadedImage;
window.sendMessage = sendMessage;
window.deleteMyAd = deleteMyAd;
window.saveUserProfile = saveUserProfile;
window.deleteSparePartListing = deleteSparePartListing;
window.removeSparePartImage = removeSparePartImage;

// ── Announcements ──────────────────────────────────────────────
(function initAnnouncements() {
    const btnNew         = document.getElementById("btn-new-announcement");
    const formWrap       = document.getElementById("announcement-form-wrapper");
    const btnClose       = document.getElementById("announcement-form-close");
    const btnCancel      = document.getElementById("ann-cancel-btn");
    const form           = document.getElementById("announcement-form");
    const list           = document.getElementById("announcements-list");
    const pagination     = document.getElementById("ann-pagination");
    const prevBtn        = document.getElementById("ann-prev-btn");
    const nextBtn        = document.getElementById("ann-next-btn");
    const pageNumbers    = document.getElementById("ann-page-numbers");

    const PAGE_SIZE = 10;
    let currentPage = 1;

    // Master data store — each entry mirrors what the DOM cards contain
    // Seed with the 5 sample announcements (newest first)
    let announcements = [
        {
            category: "update",
            tag: { label: "Platform Update", icon: "fa-bell", cls: "ann-tag-update" },
            title: "CeylonSuperHub v2.0 is Live — Faster, Smarter, Better",
            body:  "We've completely overhauled the platform with a new search engine, real-time watchlist sync, verified seller badges, and a streamlined post-ad experience. Thank you for being part of the journey.",
            author: "CeylonSuperHub Team",
            date: "July 4, 2026",
            img: null,
            pinned: true
        },
        {
            category: "event",
            tag: { label: "Event", icon: "fa-calendar-alt", cls: "ann-tag-event" },
            title: "Ceylon Supercar Showcase 2026 — Colombo Raceway",
            body:  "Join us at the annual Ceylon Supercar Showcase on August 15th at Colombo Raceway. Over 50 elite vehicles on display, including exclusive previews of newly imported Ferraris and Lamborghinis. Free entry for registered CeylonSuperHub members.",
            author: "Events Team",
            date: "June 28, 2026",
            img: null,
            pinned: false
        },
        {
            category: "offer",
            tag: { label: "Offer", icon: "fa-tag", cls: "ann-tag-offer" },
            title: "Free Featured Listings for First 100 Sellers This Month",
            body:  "To celebrate our platform growth, we're giving away 100 free Featured Ad slots — normally LKR 4,999 each. Post your supercar or superbike before June 30th to claim yours. First come, first served.",
            author: "CeylonSuperHub Team",
            date: "June 20, 2026",
            img: null,
            pinned: false
        },
        {
            category: "news",
            tag: { label: "News", icon: "fa-newspaper", cls: "ann-tag-news" },
            title: "Verified Seller Badges Now Available — Apply Today",
            body:  "We've launched our Verified Seller programme. Sellers with a verified badge have passed identity and vehicle ownership checks, giving buyers added confidence. Apply through your Profile page.",
            author: "Trust & Safety Team",
            date: "June 10, 2026",
            img: null,
            pinned: false
        },
        {
            category: "update",
            tag: { label: "Update", icon: "fa-bell", cls: "ann-tag-update" },
            title: "New Districts Added — Northern & Eastern Province Listings",
            body:  "Jaffna, Batticaloa, Trincomalee, and 5 more districts are now searchable. If you're based in the Northern or Eastern Province, update your listings to appear in local searches.",
            author: "Platform Team",
            date: "May 30, 2026",
            img: null,
            pinned: false
        },
        {
            category: "news",
            tag: { label: "News", icon: "fa-newspaper", cls: "ann-tag-news" },
            title: "CeylonSuperHub Partners with Ceylon Force Automotive",
            body:  "We're proud to announce our official partnership with Ceylon Force Automotive, Sri Lanka's leading supercar importer. Expect exclusive listings, priority import previews, and co-branded events throughout 2026.",
            author: "CeylonSuperHub Team",
            date: "May 15, 2026",
            img: null,
            pinned: false
        }
    ];

    // ── Render helpers ───────────────────────────────────────────

    function buildCardHTML(ann) {
        return `
            <div class="ann-card-side ann-side-${ann.category}"></div>
            <div class="ann-card-body">
                <div class="ann-card-top">
                    <span class="ann-tag ${ann.tag.cls}"><i class="fas ${ann.tag.icon}"></i> ${ann.tag.label}</span>
                    <span class="ann-date"><i class="fas fa-clock"></i> ${ann.date}</span>
                </div>
                <h3 class="ann-card-title">${ann.title}</h3>
                ${ann.img ? `<div class="ann-card-img-wrap"><img src="${ann.img}" alt="${ann.title}" class="ann-card-img"></div>` : ""}
                <p class="ann-card-text">${ann.body}</p>
                <div class="ann-card-footer">
                    <span class="ann-author"><i class="fas fa-user"></i> ${ann.author}</span>
                </div>
            </div>`;
    }

    function renderPage(page) {
        // Non-pinned announcements only in the paged list
        const nonPinned = announcements.filter(a => !a.pinned);
        const totalPages = Math.max(1, Math.ceil(nonPinned.length / PAGE_SIZE));
        currentPage = Math.min(Math.max(1, page), totalPages);

        const start = (currentPage - 1) * PAGE_SIZE;
        const slice = nonPinned.slice(start, start + PAGE_SIZE);

        // Render cards
        list.innerHTML = "";
        slice.forEach(ann => {
            const card = document.createElement("article");
            card.className = "announcement-card glass";
            card.innerHTML = buildCardHTML(ann);
            list.appendChild(card);
        });

        // Show / hide pagination
        if (totalPages <= 1) {
            pagination.style.display = "none";
            return;
        }
        pagination.style.display = "flex";

        // Prev / Next buttons
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        // Page number buttons
        pageNumbers.innerHTML = "";
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement("button");
            btn.className = "ann-page-num" + (i === currentPage ? " active" : "");
            btn.textContent = i;
            btn.addEventListener("click", () => goToPage(i));
            pageNumbers.appendChild(btn);
        }
    }

    function goToPage(page) {
        renderPage(page);
        // Scroll list into view smoothly
        list.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Initial render
    renderPage(1);

    // Pagination button listeners
    if (prevBtn) prevBtn.addEventListener("click", () => goToPage(currentPage - 1));
    if (nextBtn) nextBtn.addEventListener("click", () => goToPage(currentPage + 1));

    // ── Image preview wiring ─────────────────────────────────────
    const imgInput       = document.getElementById("ann-image");
    const imgPreview     = document.getElementById("ann-img-preview");
    const imgPlaceholder = document.getElementById("ann-img-placeholder");
    const imgRemove      = document.getElementById("ann-img-remove");
    let currentImgDataUrl = null;

    if (imgInput) {
        imgInput.addEventListener("change", function () {
            const file = this.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                alert("Image must be under 5 MB.");
                this.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onload = function (e) {
                currentImgDataUrl = e.target.result;
                imgPreview.src = currentImgDataUrl;
                imgPreview.style.display = "block";
                imgPlaceholder.style.display = "none";
                imgRemove.style.display = "inline-flex";
            };
            reader.readAsDataURL(file);
        });
    }

    if (imgRemove) {
        imgRemove.addEventListener("click", function () {
            currentImgDataUrl = null;
            imgInput.value = "";
            imgPreview.src = "";
            imgPreview.style.display = "none";
            imgPlaceholder.style.display = "flex";
            imgRemove.style.display = "none";
        });
    }

    // ── Form show / hide ─────────────────────────────────────────
    function showForm() {
        formWrap.style.display = "block";
        formWrap.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function hideForm() {
        formWrap.style.display = "none";
        form.reset();
        currentImgDataUrl = null;
        if (imgPreview)     { imgPreview.src = ""; imgPreview.style.display = "none"; }
        if (imgPlaceholder) { imgPlaceholder.style.display = "flex"; }
        if (imgRemove)      { imgRemove.style.display = "none"; }
        if (imgInput)       { imgInput.value = ""; }
    }

    if (btnNew)    btnNew.addEventListener("click", showForm);
    if (btnClose)  btnClose.addEventListener("click", hideForm);
    if (btnCancel) btnCancel.addEventListener("click", hideForm);

    // ── Publish ──────────────────────────────────────────────────
    if (form) {
        form.addEventListener("submit", function () {
            const title    = document.getElementById("ann-title").value.trim();
            const body     = document.getElementById("ann-body").value.trim();
            const author   = document.getElementById("ann-author").value.trim() || "CeylonSuperHub Team";
            const category = form.querySelector("input[name='ann-category']:checked")?.value || "news";

            if (!title || !body) return;

            const tagMap = {
                news:   { label: "News",   icon: "fa-newspaper",    cls: "ann-tag-news"   },
                event:  { label: "Event",  icon: "fa-calendar-alt", cls: "ann-tag-event"  },
                offer:  { label: "Offer",  icon: "fa-tag",          cls: "ann-tag-offer"  },
                update: { label: "Update", icon: "fa-bell",         cls: "ann-tag-update" }
            };
            const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

            // Prepend to data store (newest first)
            announcements.unshift({
                category,
                tag: tagMap[category],
                title,
                body,
                author,
                date: now,
                img: currentImgDataUrl,
                pinned: false
            });

            hideForm();
            // Jump to page 1 so the new item is visible immediately
            goToPage(1);

            // Flash highlight on first card
            const firstCard = list.querySelector(".announcement-card");
            if (firstCard) {
                firstCard.classList.add("ann-card-new");
                setTimeout(() => firstCard.classList.remove("ann-card-new"), 1200);
            }
        });
    }
})();
