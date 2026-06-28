// CeylonSuper Marketplace JS Engine

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
        primary: "#00a8ff",
        glow: "rgba(0, 168, 255, 0.3)",
        hover: "#33baff"
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
document.addEventListener("DOMContentLoaded", () => {
    initDatabase();
    bindEvents();
    renderSidebarCounts();
    renderListings();
    updateFavBadge();
    initHeroBackgroundInteraction();
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
            name: "Suresh Perera",
            phone: "+94 77 123 4567",
            email: "suresh@domain.lk",
            location: "Colombo",
            bio: "Supercar enthusiast and collector. Passionate about naturally aspirated engines, aerodynamic styling, and Italian engineering.",
            avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
        };
        localStorage.setItem("ceylonsuper_profile", JSON.stringify(profile));
    }

    // Initialize Settings
    const savedSettings = localStorage.getItem("ceylonsuper_settings");
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
    } else {
        settings = {
            theme: "dark",
            accent: "crimson", // default color suggested: Crimson Red
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

    // Accent Highlighting variables
    const accentData = ACCENT_PRESETS[settings.accent] || ACCENT_PRESETS.crimson;
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
        submitBtn.addEventListener("click", () => {
            if (validateStep(activeStep)) {
                submitNewAd();
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

function initHeroBackgroundInteraction() {
    const hero = document.querySelector(".hero-section");
    if (!hero) return;

    let animationFrame = 0;
    let interactionTimer = 0;

    const px = value => `${value.toFixed(2)}px`;

    const applyHeroPointer = (xPercent, yPercent) => {
        const clampedX = Math.max(0, Math.min(100, xPercent));
        const clampedY = Math.max(0, Math.min(100, yPercent));
        const xDelta = (clampedX - 50) / 50;
        const yDelta = (clampedY - 50) / 50;

        hero.style.setProperty("--hero-pointer-x", `${clampedX.toFixed(1)}%`);
        hero.style.setProperty("--hero-pointer-y", `${clampedY.toFixed(1)}%`);
        hero.style.setProperty("--hero-parallax-soft-x", px(xDelta * -8));
        hero.style.setProperty("--hero-parallax-soft-y", px(yDelta * -6));
        hero.style.setProperty("--hero-parallax-grid-x", px(xDelta * 10));
        hero.style.setProperty("--hero-parallax-grid-y", px(yDelta * 8));
        hero.style.setProperty("--hero-parallax-floor-x", px(xDelta * -5));
        hero.style.setProperty("--hero-parallax-floor-y", px(yDelta * -4));
        hero.style.setProperty("--hero-parallax-near-x", px(xDelta * 16));
        hero.style.setProperty("--hero-parallax-near-y", px(yDelta * 10));
        hero.style.setProperty("--hero-parallax-far-x", px(xDelta * -14));
        hero.style.setProperty("--hero-parallax-far-y", px(yDelta * 12));
        hero.style.setProperty("--hero-parallax-gauge-x", px(xDelta * 8));
        hero.style.setProperty("--hero-parallax-gauge-y", px(yDelta * -8));
    };

    const queuePointerUpdate = (clientX, clientY) => {
        const rect = hero.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const xPercent = ((clientX - rect.left) / rect.width) * 100;
        const yPercent = ((clientY - rect.top) / rect.height) * 100;

        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(() => {
            applyHeroPointer(xPercent, yPercent);
            animationFrame = 0;
        });
    };

    const markInteracting = () => {
        hero.classList.add("is-interacting");
        window.clearTimeout(interactionTimer);
        interactionTimer = window.setTimeout(() => {
            hero.classList.remove("is-interacting");
        }, 650);
    };

    hero.addEventListener("pointermove", event => {
        queuePointerUpdate(event.clientX, event.clientY);
    }, { passive: true });

    hero.addEventListener("pointerdown", event => {
        queuePointerUpdate(event.clientX, event.clientY);
        markInteracting();
    }, { passive: true });

    hero.addEventListener("touchmove", event => {
        const touch = event.touches[0];
        if (!touch) return;
        queuePointerUpdate(touch.clientX, touch.clientY);
        markInteracting();
    }, { passive: true });

    hero.addEventListener("pointerleave", () => {
        applyHeroPointer(50, 48);
        hero.classList.remove("is-interacting");
    }, { passive: true });
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

    if (viewName === "home") {
        homeLayout.style.display = "block";
        postAdSection.classList.remove("active");
        sparePartsSection.classList.remove("active");
        infoSection.classList.remove("active");
        profileSection.classList.remove("active");
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
        sparePartsSection.classList.remove("active");
        infoSection.classList.remove("active");
        profileSection.classList.remove("active");
        resetPostForm();
        prefillPostAdFormFromProfile();
    } else if (viewName === "spare-parts") {
        homeLayout.style.display = "none";
        postAdSection.classList.remove("active");
        sparePartsSection.classList.add("active");
        infoSection.classList.remove("active");
        profileSection.classList.remove("active");
        prefillSparePartsFormFromProfile();
        renderSparePartsList();
    } else if (viewName === "favorites") {
        homeLayout.style.display = "block";
        postAdSection.classList.remove("active");
        sparePartsSection.classList.remove("active");
        infoSection.classList.remove("active");
        profileSection.classList.remove("active");
        renderFavorites();
    } else if (viewName === "profile") {
        homeLayout.style.display = "none";
        postAdSection.classList.remove("active");
        sparePartsSection.classList.remove("active");
        infoSection.classList.remove("active");
        profileSection.classList.add("active");
        renderProfileView();
    } else if (viewName === "info") {
        homeLayout.style.display = "none";
        postAdSection.classList.remove("active");
        sparePartsSection.classList.remove("active");
        infoSection.classList.add("active");
        profileSection.classList.remove("active");
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

// Prefill ad upload sheet with current user profile
function prefillPostAdFormFromProfile() {
    const nameField = document.getElementById("ad-seller-name");
    const phoneField = document.getElementById("ad-seller-phone");
    const emailField = document.getElementById("ad-seller-email");
    const locField = document.getElementById("ad-seller-location");

    if (nameField && profile.name) nameField.value = profile.name;
    if (phoneField && profile.phone) phoneField.value = profile.phone;
    if (emailField && profile.email) emailField.value = profile.email;
    if (locField && profile.location) syncCustomDropdown("ad-seller-location", profile.location);
}

function prefillSparePartsFormFromProfile() {
    const nameField = document.getElementById("spare-seller-name");
    const phoneField = document.getElementById("spare-seller-phone");
    const locationField = document.getElementById("spare-location");

    if (nameField && profile.name) nameField.value = profile.name;
    if (phoneField && profile.phone) phoneField.value = profile.phone;
    if (locationField && profile.location) {
        syncCustomDropdown("spare-location", profile.location);
    }
}

function submitSparePart() {
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

    if (!isValid) {
        alert("Please fill all required spare part details.");
        return;
    }

    const sparePart = {
        id: "spare-" + Date.now(),
        name: document.getElementById("spare-part-name").value.trim(),
        category: document.getElementById("spare-part-category").value,
        compatible: document.getElementById("spare-compatible").value.trim(),
        condition: document.getElementById("spare-condition").value,
        price: parseInt(document.getElementById("spare-price").value, 10) || 0,
        location: document.getElementById("spare-location").value,
        sellerName: document.getElementById("spare-seller-name").value.trim(),
        sellerPhone: document.getElementById("spare-seller-phone").value.trim(),
        description: document.getElementById("spare-description").value.trim(),
        dateAdded: new Date().toISOString().split("T")[0]
    };

    spareParts.unshift(sparePart);
    localStorage.setItem("ceylonsuper_spare_parts", JSON.stringify(spareParts));

    resetSparePartsForm();
    renderSparePartsList();
    renderSidebarCounts();
    alert("Spare part details submitted successfully.");
}

function resetSparePartsForm() {
    const form = document.getElementById("spare-parts-form");
    if (form) form.reset();

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

    container.innerHTML = spareParts.map(part => `
        <article class="spare-part-card">
            <div>
                <div class="spare-part-title">${part.name}</div>
                <div class="spare-part-meta">
                    <span><i class="fas fa-tag"></i> ${part.category}</span>
                    <span><i class="fas fa-car-side"></i> ${part.compatible}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${part.location}</span>
                </div>
                <p>${part.description}</p>
            </div>
            <div class="spare-part-side">
                <span class="spare-part-condition">${part.condition}</span>
                <strong>${formatPriceLKR(part.price)}</strong>
                <a href="tel:${part.sellerPhone}" class="btn-my-ad-action">
                    <i class="fas fa-phone"></i> Contact
                </a>
            </div>
        </article>
    `).join("");
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
}

// Render My Listings sub-tab in Profile page
function renderMyAdsList() {
    const container = document.getElementById("my-ads-container-list");
    if (!container) return;

    container.innerHTML = "";
    const myAds = ads.filter(a => a.id.includes("custom") || a.sellerPhone === profile.phone);

    if (myAds.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px 10px; color: var(--text-secondary)">
                <i class="fas fa-car-side" style="font-size:2.5rem; margin-bottom:12px; color:var(--text-muted)"></i>
                <p>You have not posted any premium vehicle ads yet.</p>
                <button type="button" class="btn-post" style="margin: 15px auto 0; padding:8px 18px" onclick="switchView('post-ad')">Post Ad Now</button>
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

// Delete user ad
function deleteMyAd(event, id) {
    event.stopPropagation();
    if (!confirm("Are you sure you want to delete this listing permanently?")) return;

    const idx = ads.findIndex(a => a.id === id);
    if (idx > -1) {
        const deletedTitle = ads[idx].title;
        ads.splice(idx, 1);
        localStorage.setItem("ceylonsuper_ads", JSON.stringify(ads));

        renderProfileView();
        renderSidebarCounts();
        renderListings();
        alert("Listing for '" + deletedTitle + "' deleted successfully.");
    }
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
    const countSpareParts = document.getElementById("count-spare-parts");
    if (countSupercars) countSupercars.innerText = totalSupercars;
    if (countSuperbikes) countSuperbikes.innerText = totalSuperbikes;
    if (countSpareParts) countSpareParts.innerText = spareParts.length;

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

function formatPriceUSD(priceLkr) {
    // Assume 1 USD = 300 LKR for rough mock conversion
    const priceUsd = Math.round(priceLkr / 300);
    return "$" + priceUsd.toLocaleString("en-US");
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
                    
                    <button class="contact-action-btn btn-chat" onclick="openChatSimulator('${ad.sellerName}', '${ad.title}')">
                        <i class="far fa-comments"></i> Chat with Agent
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

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.match("image.*")) continue;

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

// Submit the ad and store in localStorage
function submitNewAd() {
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
    const power = document.getElementById("ad-power").value || "";
    const topSpeed = parseInt(document.getElementById("ad-speed").value) || 299;
    const zeroToHundred = document.getElementById("ad-acceleration").value || "";

    const price = parseInt(document.getElementById("ad-price").value) || 0;
    const description = document.getElementById("ad-desc").value;

    const sellerName = document.getElementById("ad-seller-name").value;
    const sellerPhone = document.getElementById("ad-seller-phone").value;
    const sellerEmail = document.getElementById("ad-seller-email").value;
    const location = document.getElementById("ad-seller-location").value;

    let images = [...uploadedImages];
    const customUrlInput = document.getElementById("ad-unsplash-urls");
    if (customUrlInput && customUrlInput.value.trim()) {
        const urls = customUrlInput.value.split(",").map(url => url.trim()).filter(url => url.length > 0);
        images = [...images, ...urls];
    }

    if (images.length === 0) {
        images.push(type === "supercar" ?
            "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&w=800&q=80" :
            "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80"
        );
    }

    const newAd = {
        id: "cs-custom-" + Date.now(),
        title: `${make} ${model} ${year}`,
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
        dateAdded: new Date().toISOString().split('T')[0],
        featured: false
    };

    ads.unshift(newAd);
    localStorage.setItem("ceylonsuper_ads", JSON.stringify(ads));

    resetPostForm();
    renderSidebarCounts();
    alert("Success! Your premium listing for the " + make + " " + model + " has been posted successfully.");
    switchView("home");
}

function resetPostForm() {
    document.getElementById("post-ad-form").reset();
    uploadedImages = [];
    const previewContainer = document.getElementById("upload-previews-container");
    if (previewContainer) previewContainer.innerHTML = "";
    activeStep = 1;
    goToStep(1);
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
