(function () {
  "use strict";

  const TIMEZONE = "Asia/Kolkata";
  const BOOKING_WINDOW_DAYS = 8;
  const API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) || "PASTE_APPS_SCRIPT_WEB_APP_URL_HERE";

  const state = {
    authMode: "student",
    student: null,
    branchOptions: [],
    branchSession: null,
    serverTodayKey: "",
    serverNowIso: "",
    selectedDate: "",
    adminSelectedDate: "",
    slots: [],
    adminData: {
      summary: null,
      slots: [],
      bookings: []
    },
    history: {
      upcoming: [],
      past: [],
      cancelled: []
    },
    activeHistoryTab: "upcoming",
    pendingSlot: null,
    ticket: null,
    currentQrCode: null
  };

  const elements = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    bindEvents();
    toggleConfigBanner();
    setAuthMode(state.authMode);
    renderBranchOptions();
    if (isApiConfigured()) {
      loadBranchOptions();
    }
  }

  function cacheElements() {
    elements.authPanel = document.getElementById("authPanel");
    elements.dashboard = document.getElementById("dashboard");
    elements.adminDashboard = document.getElementById("adminDashboard");
    elements.logoutButton = document.getElementById("logoutButton");
    elements.authModeButtons = Array.from(document.querySelectorAll("[data-auth-mode]"));
    elements.studentLoginView = document.getElementById("studentLoginView");
    elements.branchLoginView = document.getElementById("branchLoginView");
    elements.loginForm = document.getElementById("loginForm");
    elements.loginButton = document.getElementById("loginButton");
    elements.regnoInput = document.getElementById("regnoInput");
    elements.branchLoginForm = document.getElementById("branchLoginForm");
    elements.branchLoginButton = document.getElementById("branchLoginButton");
    elements.branchSelect = document.getElementById("branchSelect");
    elements.branchPasscodeInput = document.getElementById("branchPasscodeInput");
    elements.configBanner = document.getElementById("configBanner");
    elements.studentName = document.getElementById("studentName");
    elements.studentRegno = document.getElementById("studentRegno");
    elements.studentCenter = document.getElementById("studentCenter");
    elements.studentCourse = document.getElementById("studentCourse");
    elements.nextBookingPanel = document.getElementById("nextBookingPanel");
    elements.nextBookingTitle = document.getElementById("nextBookingTitle");
    elements.nextBookingText = document.getElementById("nextBookingText");
    elements.selectedDateBadge = document.getElementById("selectedDateBadge");
    elements.dateRailPrev = document.getElementById("dateRailPrev");
    elements.dateRailNext = document.getElementById("dateRailNext");
    elements.dateRail = document.getElementById("dateRail");
    elements.slotGrid = document.getElementById("slotGrid");
    elements.slotMessage = document.getElementById("slotMessage");
    elements.adminBranchName = document.getElementById("adminBranchName");
    elements.adminManagerName = document.getElementById("adminManagerName");
    elements.adminCapacity = document.getElementById("adminCapacity");
    elements.adminSelectedDate = document.getElementById("adminSelectedDate");
    elements.adminTotalBooked = document.getElementById("adminTotalBooked");
    elements.adminPeakOccupancy = document.getElementById("adminPeakOccupancy");
    elements.adminMostBookedSlot = document.getElementById("adminMostBookedSlot");
    elements.adminFullyBookedSlots = document.getElementById("adminFullyBookedSlots");
    elements.adminDateBadge = document.getElementById("adminDateBadge");
    elements.adminDateRailPrev = document.getElementById("adminDateRailPrev");
    elements.adminDateRailNext = document.getElementById("adminDateRailNext");
    elements.adminDateRail = document.getElementById("adminDateRail");
    elements.adminSlotMessage = document.getElementById("adminSlotMessage");
    elements.adminSlotGrid = document.getElementById("adminSlotGrid");
    elements.adminRosterCount = document.getElementById("adminRosterCount");
    elements.adminRosterList = document.getElementById("adminRosterList");
    elements.historyTabs = Array.from(document.querySelectorAll(".history-tab"));
    elements.historyList = document.getElementById("historyList");
    elements.confirmModal = document.getElementById("confirmModal");
    elements.confirmDetails = document.getElementById("confirmDetails");
    elements.confirmBookingButton = document.getElementById("confirmBookingButton");
    elements.ticketModal = document.getElementById("ticketModal");
    elements.ticketBookingId = document.getElementById("ticketBookingId");
    elements.ticketQr = document.getElementById("ticketQr");
    elements.ticketDetails = document.getElementById("ticketDetails");
    elements.copyBookingIdButton = document.getElementById("copyBookingIdButton");
    elements.toastRegion = document.getElementById("toastRegion");
  }

  function bindEvents() {
    elements.authModeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setAuthMode(button.dataset.authMode);
      });
    });

    elements.loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const regno = normalizeRegno(elements.regnoInput.value);
      loginWithRegno(regno);
    });

    elements.branchLoginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      loginBranchHead(elements.branchSelect.value, elements.branchPasscodeInput.value);
    });

    elements.regnoInput.addEventListener("input", function () {
      this.value = this.value.replace(/\D/g, "").slice(0, 8);
    });

    elements.logoutButton.addEventListener("click", logout);
    elements.dateRailPrev.addEventListener("click", function () {
      scrollDateRail(-1);
    });
    elements.dateRailNext.addEventListener("click", function () {
      scrollDateRail(1);
    });
    elements.adminDateRailPrev.addEventListener("click", function () {
      scrollAdminDateRail(-1);
    });
    elements.adminDateRailNext.addEventListener("click", function () {
      scrollAdminDateRail(1);
    });

    elements.historyTabs.forEach(function (button) {
      button.addEventListener("click", function () {
        state.activeHistoryTab = button.dataset.historyTab;
        updateHistoryTabs();
        renderHistory();
      });
    });

    elements.confirmBookingButton.addEventListener("click", confirmBooking);
    elements.copyBookingIdButton.addEventListener("click", copyBookingId);

    document.querySelectorAll("[data-close-modal]").forEach(function (button) {
      button.addEventListener("click", function () {
        hideModal(button.dataset.closeModal);
      });
    });

    document.addEventListener("click", function (event) {
      const shell = event.target.closest(".modal-shell");
      if (shell && event.target === shell) {
        hideModal(shell.id);
      }
    });
  }

  function toggleConfigBanner() {
    elements.configBanner.classList.toggle("is-hidden", isApiConfigured());
  }

  function setAuthMode(mode) {
    const normalizedMode = mode === "branch" ? "branch" : "student";
    state.authMode = normalizedMode;

    elements.authModeButtons.forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.authMode === normalizedMode);
    });

    elements.studentLoginView.classList.toggle("is-hidden", normalizedMode !== "student");
    elements.branchLoginView.classList.toggle("is-hidden", normalizedMode !== "branch");

    if (normalizedMode === "branch") {
      if (isApiConfigured() && !state.branchOptions.length) {
        loadBranchOptions();
      }
      elements.branchSelect.focus();
      return;
    }

    elements.regnoInput.focus();
  }

  async function loadBranchOptions() {
    if (!isApiConfigured()) {
      renderBranchOptions();
      return;
    }

    try {
      const data = await apiGet("branch_options", {});
      state.branchOptions = data.branches || [];
      renderBranchOptions();
    } catch (error) {
      state.branchOptions = [];
      renderBranchOptions("Could not load branches");
    }
  }

  function renderBranchOptions(placeholderLabel) {
    const placeholder = placeholderLabel || "Select branch";
    const currentValue = (state.branchSession && state.branchSession.branch) || elements.branchSelect.value || "";
    const options = ['<option value="">' + escapeHtml(placeholder) + "</option>"].concat(
      state.branchOptions.map(function (branchOption) {
        return '<option value="' + escapeHtml(branchOption.branch) + '">' + escapeHtml(branchOption.branch) + "</option>";
      })
    );

    elements.branchSelect.innerHTML = options.join("");

    if (currentValue) {
      elements.branchSelect.value = currentValue;
    }
  }

  async function loginBranchHead(branch, passcode) {
    const normalizedBranch = String(branch || "").trim();
    const normalizedPasscode = String(passcode || "").trim();

    if (!isApiConfigured()) {
      toast("Add your Apps Script URL in config.js before logging in.");
      return;
    }

    if (!normalizedBranch) {
      toast("Please choose a branch.");
      return;
    }

    if (!normalizedPasscode) {
      toast("Please enter the branch passcode.");
      return;
    }

    setButtonLoading(elements.branchLoginButton, true, "Checking...");

    try {
      const data = await apiPost("branch_login", {
        branch: normalizedBranch,
        passcode: normalizedPasscode
      });

      state.student = null;
      state.branchSession = {
        branch: data.admin.branch,
        managerName: data.admin.managerName,
        capacity: data.admin.capacity,
        passcode: normalizedPasscode
      };
      state.adminSelectedDate = state.serverTodayKey || getIstTodayKey();

      renderBranchProfile(data.admin);
      hydrateAdminDateRail();
      await loadBranchDashboard(state.adminSelectedDate);

      elements.authPanel.classList.add("is-hidden");
      elements.dashboard.classList.add("is-hidden");
      elements.adminDashboard.classList.remove("is-hidden");
      elements.logoutButton.classList.remove("is-hidden");
      toast("Branch dashboard loaded.");
    } catch (error) {
      toast(error.message || "We could not open the branch dashboard.");
    } finally {
      setButtonLoading(elements.branchLoginButton, false, "Enter");
    }
  }

  async function loginWithRegno(regno) {
    if (!isApiConfigured()) {
      toast("Add your Apps Script URL in config.js before logging in.");
      return;
    }

    if (!/^\d{8}$/.test(regno)) {
      toast("Please enter a valid 8-digit registration number.");
      return;
    }

    setButtonLoading(elements.loginButton, true, "Checking...");

    try {
      const data = await apiGet("student", { regno: regno });
      state.authMode = "student";
      state.branchSession = null;
      state.adminSelectedDate = "";
      state.student = data.student;
      elements.regnoInput.value = regno;
      renderStudentProfile();
      hydrateDateRail();
      await Promise.all([loadSlots(state.selectedDate), loadHistory()]);
      elements.authPanel.classList.add("is-hidden");
      elements.dashboard.classList.remove("is-hidden");
      elements.adminDashboard.classList.add("is-hidden");
      elements.logoutButton.classList.remove("is-hidden");
      toast("Student profile loaded.");
    } catch (error) {
      toast(error.message || "We could not find that registration number.");
      logout(false);
    } finally {
      setButtonLoading(elements.loginButton, false, "Enter");
    }
  }

  function logout(showToast) {
    state.authMode = "student";
    state.student = null;
    state.branchSession = null;
    state.serverTodayKey = "";
    state.serverNowIso = "";
    state.selectedDate = "";
    state.adminSelectedDate = "";
    state.slots = [];
    state.adminData = {
      summary: null,
      slots: [],
      bookings: []
    };
    state.history = { upcoming: [], past: [], cancelled: [] };
    state.activeHistoryTab = "upcoming";
    state.pendingSlot = null;
    state.ticket = null;
    destroyQrCode();

    elements.dashboard.classList.add("is-hidden");
    elements.adminDashboard.classList.add("is-hidden");
    elements.authPanel.classList.remove("is-hidden");
    elements.logoutButton.classList.add("is-hidden");
    elements.confirmModal.classList.add("is-hidden");
    elements.ticketModal.classList.add("is-hidden");
    elements.slotGrid.innerHTML = "";
    elements.historyList.innerHTML = "";
    elements.dateRail.innerHTML = "";
    elements.adminDateRail.innerHTML = "";
    elements.adminSlotGrid.innerHTML = "";
    elements.adminRosterList.innerHTML = "";
    elements.nextBookingPanel.classList.add("is-hidden");
    elements.nextBookingTitle.textContent = "No upcoming booking";
    elements.nextBookingText.textContent = "";
    elements.selectedDateBadge.textContent = "-";
    elements.adminDateBadge.textContent = "-";
    elements.adminSelectedDate.textContent = "-";
    elements.adminBranchName.textContent = "Branch Name";
    elements.adminManagerName.textContent = "-";
    elements.adminCapacity.textContent = "-";
    elements.adminTotalBooked.textContent = "0";
    elements.adminPeakOccupancy.textContent = "0%";
    elements.adminMostBookedSlot.textContent = "-";
    elements.adminFullyBookedSlots.textContent = "0";
    elements.adminRosterCount.textContent = "0 booked";
    elements.branchPasscodeInput.value = "";
    setAuthMode("student");
    elements.regnoInput.focus();
    updateHistoryTabs();

    if (showToast !== false) {
      toast("Logged out.");
    }
  }

  function renderStudentProfile() {
    elements.studentName.textContent = state.student.name;
    elements.studentRegno.textContent = state.student.regno;
    elements.studentCenter.textContent = state.student.center;
    elements.studentCourse.textContent = state.student.course;
  }

  function renderBranchProfile(admin) {
    const branchSession = state.branchSession || {};
    const branchName = (admin && admin.branch) || branchSession.branch || "Branch Name";
    const managerName = (admin && admin.managerName) || branchSession.managerName || "Branch Head";
    const capacity = (admin && admin.capacity) || branchSession.capacity || "-";
    const formattedDate = state.adminSelectedDate ? formatDateLabel(state.adminSelectedDate).longDate : "-";

    elements.adminBranchName.textContent = branchName;
    elements.adminManagerName.textContent = managerName;
    elements.adminCapacity.textContent = String(capacity);
    elements.adminSelectedDate.textContent = formattedDate;
    elements.adminDateBadge.textContent = formattedDate;
  }

  function hydrateDateRail() {
    const todayKey = state.serverTodayKey || getIstTodayKey();
    const dates = [];
    for (let index = 0; index < BOOKING_WINDOW_DAYS; index += 1) {
      dates.push(addDaysToDateKey(todayKey, index));
    }
    if (!state.selectedDate || dates.indexOf(state.selectedDate) === -1) {
      state.selectedDate = dates[0];
    }

    elements.dateRail.innerHTML = dates.map(function (dateKey, index) {
      const formatted = formatDateLabel(dateKey);
      const helper = index === 0 ? "Today" : index === 1 ? "Tomorrow" : formatted.shortDay;
      const activeClass = state.selectedDate === dateKey ? " is-active" : "";

      return (
        '<button class="date-chip' + activeClass + '" type="button" data-date-key="' + escapeHtml(dateKey) + '">' +
          "<span>" + escapeHtml(formatted.longDate) + "</span>" +
          "<small>" + escapeHtml(helper) + "</small>" +
        "</button>"
      );
    }).join("");

    Array.from(elements.dateRail.querySelectorAll("[data-date-key]")).forEach(function (button) {
      button.addEventListener("click", function () {
        state.selectedDate = button.dataset.dateKey;
        hydrateDateRail();
        loadSlots(state.selectedDate);
      });
    });

    elements.selectedDateBadge.textContent = formatDateLabel(state.selectedDate).longDate;
    const activeChip = elements.dateRail.querySelector(".date-chip.is-active");
    if (activeChip) {
      activeChip.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }

  function scrollDateRail(direction) {
    const distance = Math.max(elements.dateRail.clientWidth * 0.7, 220);
    elements.dateRail.scrollBy({
      left: distance * direction,
      behavior: "smooth"
    });
  }

  function hydrateAdminDateRail() {
    const todayKey = state.serverTodayKey || getIstTodayKey();
    const dates = [];
    for (let index = 0; index < BOOKING_WINDOW_DAYS; index += 1) {
      dates.push(addDaysToDateKey(todayKey, index));
    }
    if (!state.adminSelectedDate || dates.indexOf(state.adminSelectedDate) === -1) {
      state.adminSelectedDate = dates[0];
    }

    elements.adminDateRail.innerHTML = dates.map(function (dateKey, index) {
      const formatted = formatDateLabel(dateKey);
      const helper = index === 0 ? "Today" : index === 1 ? "Tomorrow" : formatted.shortDay;
      const activeClass = state.adminSelectedDate === dateKey ? " is-active" : "";

      return (
        '<button class="date-chip' + activeClass + '" type="button" data-admin-date-key="' + escapeHtml(dateKey) + '">' +
          "<span>" + escapeHtml(formatted.longDate) + "</span>" +
          "<small>" + escapeHtml(helper) + "</small>" +
        "</button>"
      );
    }).join("");

    Array.from(elements.adminDateRail.querySelectorAll("[data-admin-date-key]")).forEach(function (button) {
      button.addEventListener("click", function () {
        state.adminSelectedDate = button.dataset.adminDateKey;
        hydrateAdminDateRail();
        loadBranchDashboard(state.adminSelectedDate);
      });
    });

    elements.adminDateBadge.textContent = formatDateLabel(state.adminSelectedDate).longDate;
    const activeChip = elements.adminDateRail.querySelector(".date-chip.is-active");
    if (activeChip) {
      activeChip.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }

  function scrollAdminDateRail(direction) {
    const distance = Math.max(elements.adminDateRail.clientWidth * 0.7, 220);
    elements.adminDateRail.scrollBy({
      left: distance * direction,
      behavior: "smooth"
    });
  }

  async function loadBranchDashboard(dateKey) {
    if (!state.branchSession) {
      return;
    }

    elements.adminSlotGrid.innerHTML = buildSkeletonCards(4);
    elements.adminRosterList.innerHTML = '<div class="empty-state">Loading branch roster...</div>';
    elements.adminSlotMessage.classList.add("is-hidden");

    try {
      const data = await apiPost("branch_dashboard", {
        branch: state.branchSession.branch,
        passcode: state.branchSession.passcode,
        date: dateKey
      });

      state.adminSelectedDate = data.date || dateKey;

      state.adminData = {
        summary: data.summary || null,
        slots: data.slots || [],
        bookings: data.bookings || []
      };

      if (data.admin) {
        state.branchSession.branch = data.admin.branch;
        state.branchSession.managerName = data.admin.managerName;
        state.branchSession.capacity = data.admin.capacity;
      }

      renderBranchProfile(data.admin);
      renderAdminSummary(data);
      renderAdminSlots(data);
      renderAdminRoster(data);
    } catch (error) {
      elements.adminSlotGrid.innerHTML = '<div class="empty-state">Branch slots could not be loaded.</div>';
      elements.adminRosterList.innerHTML = '<div class="empty-state">Roster could not be loaded.</div>';
      elements.adminSlotMessage.textContent = error.message || "We could not load the branch dashboard right now.";
      elements.adminSlotMessage.classList.remove("is-hidden");
    }
  }

  async function loadSlots(dateKey) {
    if (!state.student) {
      return;
    }

    elements.slotGrid.innerHTML = buildSkeletonCards(6);
    elements.slotMessage.classList.add("is-hidden");
    elements.selectedDateBadge.textContent = formatDateLabel(dateKey).longDate;

    try {
      const data = await apiGet("slots", {
        regno: state.student.regno,
        date: dateKey
      });
      state.slots = data.slots || [];
      renderSlots(data);
    } catch (error) {
      elements.slotGrid.innerHTML = "";
      elements.slotMessage.textContent = error.message || "We could not load slots right now.";
      elements.slotMessage.classList.remove("is-hidden");
    }
  }

  function renderSlots(payload) {
    const slots = payload.slots || [];
    const myBooking = slots.find(function (slot) {
      return slot.bookedByStudent;
    });
    const availableSlots = slots.filter(function (slot) {
      return slot.bookable;
    });

    if (!slots.length) {
      elements.slotGrid.innerHTML = '<div class="empty-state">No slots are available for this date.</div>';
      return;
    }

    if (myBooking) {
      elements.slotMessage.textContent =
        "You already have a booking for this date: " + myBooking.label + ". Cancel it from Booking History if needed.";
      elements.slotMessage.classList.remove("is-hidden");
      elements.slotGrid.innerHTML =
        '<div class="empty-state">Your booking for this date is already confirmed.</div>';
      return;
    }

    if (!availableSlots.length) {
      elements.slotMessage.textContent = "No available slots left for this date.";
      elements.slotMessage.classList.remove("is-hidden");
      elements.slotGrid.innerHTML =
        '<div class="empty-state">Try another date to see more available slots.</div>';
      return;
    }

    elements.slotMessage.classList.add("is-hidden");

    elements.slotGrid.innerHTML = availableSlots.map(function (slot, index) {
      return (
        '<article class="slot-card" style="animation-delay:' + (index * 40) + 'ms">' +
          '<div class="slot-card-head">' +
            "<div>" +
              '<p class="slot-time">' + escapeHtml(slot.label) + "</p>" +
              '<span class="meta-label">' + escapeHtml(slot.booked) + " booked • " + escapeHtml(String(slot.capacity)) + " capacity</span>" +
            "</div>" +
            '<span class="status-pill ' + getStatusClass(slot.status, true) + '">' + escapeHtml(slot.status) + "</span>" +
          "</div>" +
          '<div class="slot-meta-row">' +
            '<span class="slot-chip">' + escapeHtml(String(slot.remaining)) + ' systems left</span>' +
            '<span class="slot-chip">' + escapeHtml(String(slot.occupancyPct)) + '% occupied</span>' +
          "</div>" +
          '<div class="slot-progress"><span style="width:' + clampPercent(slot.occupancyPct) + '%"></span></div>' +
          '<div class="slot-foot">' +
            '<span class="meta-label">Tap to confirm this slot</span>' +
            '<button class="slot-book-button" type="button" data-slot-key="' + escapeHtml(slot.slotKey) + '">Book This Slot</button>' +
          "</div>" +
        "</article>"
      );
    }).join("");

    Array.from(elements.slotGrid.querySelectorAll("[data-slot-key]")).forEach(function (button) {
      button.addEventListener("click", function () {
        const selectedSlot = state.slots.find(function (slot) {
          return slot.slotKey === button.dataset.slotKey;
        });
        if (selectedSlot) {
          openConfirmModal(selectedSlot);
        }
      });
    });

    Array.from(elements.slotGrid.querySelectorAll(".slot-card")).forEach(function (card, index) {
      const slot = availableSlots[index];
      const metaLabel = card.querySelector(".slot-card-head .meta-label");
      const helperLabel = card.querySelector(".slot-foot .meta-label");
      const slotFoot = card.querySelector(".slot-foot");
      const primaryButton = card.querySelector(".slot-book-button");
      if (metaLabel) {
        metaLabel.textContent = slot.booked + " booked | " + slot.capacity + " capacity";
      }
      if (helperLabel) {
        helperLabel.remove();
      }
      if (slotFoot && primaryButton && !slotFoot.querySelector(".slot-info-button")) {
        const infoButton = document.createElement("button");
        infoButton.type = "button";
        infoButton.disabled = true;
        infoButton.className = "slot-info-button";
        infoButton.textContent = slot.remaining + " Left";
        slotFoot.insertBefore(infoButton, primaryButton);
      }
    });
  }

  function renderAdminSummary(payload) {
    const summary = payload.summary || {};
    const formattedDate = formatDateLabel(state.adminSelectedDate).longDate;

    elements.adminSelectedDate.textContent = formattedDate;
    elements.adminDateBadge.textContent = formattedDate;
    elements.adminTotalBooked.textContent = String(summary.uniqueStudentsBooked || 0);
    elements.adminPeakOccupancy.textContent = String(summary.peakOccupancyPct || 0) + "%";
    elements.adminMostBookedSlot.textContent = summary.mostBookedSlotLabel || "-";
    elements.adminFullyBookedSlots.textContent = String(summary.fullyBookedSlots || 0);
    elements.adminRosterCount.textContent = String(summary.totalBooked || 0) + " booked";
    elements.adminSlotMessage.textContent = (summary.totalBooked || 0) > 0 ?
      String(summary.totalBooked || 0) + " bookings are scheduled for " + formattedDate + "." :
      "No bookings are scheduled for " + formattedDate + ".";
    elements.adminSlotMessage.classList.remove("is-hidden");
  }

  function renderAdminSlots(payload) {
    const slots = payload.slots || [];

    if (!slots.length) {
      elements.adminSlotGrid.innerHTML = '<div class="empty-state">No branch slots are available for this date.</div>';
      return;
    }

    elements.adminSlotGrid.innerHTML = slots.map(function (slot, index) {
      return (
        '<article class="slot-card admin-slot-card" style="animation-delay:' + (index * 40) + 'ms">' +
          '<div class="slot-card-head">' +
            "<div>" +
              '<p class="slot-time">' + escapeHtml(slot.label) + "</p>" +
              '<span class="meta-label">' + escapeHtml(String(slot.booked)) + " booked | " + escapeHtml(String(slot.capacity)) + " capacity</span>" +
            "</div>" +
            '<span class="status-pill ' + getStatusClass(slot.status, true) + '">' + escapeHtml(slot.status) + "</span>" +
          "</div>" +
          '<div class="slot-meta-row">' +
            '<span class="slot-chip">' + escapeHtml(String(slot.booked)) + ' booked</span>' +
            '<span class="slot-chip">' + escapeHtml(String(slot.remaining)) + ' remaining</span>' +
            '<span class="slot-chip">' + escapeHtml(String(slot.occupancyPct)) + '% occupied</span>' +
          "</div>" +
          '<div class="slot-progress"><span style="width:' + clampPercent(slot.occupancyPct) + '%"></span></div>' +
          '<div class="slot-foot">' +
            '<span class="slot-info-button">' + escapeHtml(String(slot.capacity)) + ' systems</span>' +
            '<span class="slot-info-button admin-pill-right">' + escapeHtml(String(slot.remaining)) + ' left</span>' +
          "</div>" +
        "</article>"
      );
    }).join("");
  }

  function renderAdminRoster(payload) {
    const bookings = payload.bookings || [];

    if (!bookings.length) {
      elements.adminRosterList.innerHTML = '<div class="empty-state">No students are booked for this branch on the selected date.</div>';
      return;
    }

    elements.adminRosterList.innerHTML = bookings.map(function (booking) {
      return (
        '<article class="history-card admin-roster-card">' +
          '<div class="history-card-head">' +
            "<div>" +
              '<strong class="history-slot-title">' + escapeHtml(booking.studentName) + "</strong>" +
              '<div class="history-chip-row">' +
                '<span class="booking-id-chip">' + escapeHtml(booking.slotLabel) + "</span>" +
                '<span class="booking-id-chip">' + escapeHtml(booking.bookingId) + "</span>" +
              "</div>" +
            "</div>" +
            '<span class="status-pill status-available">Booked</span>' +
          "</div>" +
          '<div class="history-card-body">' +
            buildHistoryMeta("Registration No.", booking.regno) +
            buildHistoryMeta("Course", booking.course) +
            buildHistoryMeta("Date", formatDateLabel(booking.date).longDate) +
            buildHistoryMeta("Created", formatDateTimeLabel(booking.createdAt)) +
          "</div>" +
        "</article>"
      );
    }).join("");
  }

  async function loadHistory() {
    if (!state.student) {
      return;
    }

    try {
      const data = await apiGet("bookings", { regno: state.student.regno });
      state.history = {
        upcoming: data.upcoming || [],
        past: data.past || [],
        cancelled: data.cancelled || []
      };
      renderNextBooking();
      renderHistory();
    } catch (error) {
      elements.historyList.innerHTML = '<div class="empty-state">History could not be loaded.</div>';
    }
  }

  function renderHistory() {
    const activeItems = state.history[state.activeHistoryTab] || [];

    if (!activeItems.length) {
      elements.historyList.innerHTML =
        '<div class="empty-state">No ' + escapeHtml(state.activeHistoryTab) + " bookings found yet.</div>";
      return;
    }

    elements.historyList.innerHTML = activeItems.map(function (booking) {
      return (
        '<article class="history-card">' +
          '<div class="history-card-head">' +
            "<div>" +
              '<strong class="history-slot-title">' + escapeHtml(booking.slotLabel) + "</strong>" +
              '<div class="history-chip-row">' +
                '<span class="booking-id-chip">' + escapeHtml(booking.bookingId) + "</span>" +
              "</div>" +
            "</div>" +
            '<span class="status-pill ' + getStatusClass(booking.status, booking.status === "BOOKED" || booking.status === "CANCELLED") + '">' +
              escapeHtml(getHistoryStatusLabel(booking)) +
            "</span>" +
          "</div>" +
          '<div class="history-card-body">' +
            buildHistoryMeta("Date", formatDateLabel(booking.date).longDate) +
            buildHistoryMeta("Center", booking.center) +
            buildHistoryMeta("Course", booking.course) +
            buildHistoryMeta("Created", formatDateTimeLabel(booking.createdAt)) +
          "</div>" +
          '<div class="history-card-actions">' +
            (booking.status === "BOOKED" ?
              '<button class="history-action-button" type="button" data-view-ticket="' + escapeHtml(booking.bookingId) + '">View Ticket</button>' :
              "") +
            (booking.canCancel ?
              '<button class="history-action-button history-action-danger" type="button" data-cancel-booking="' + escapeHtml(booking.bookingId) + '">Cancel Booking</button>' :
              "") +
          '</div>' +
        "</article>"
      );
    }).join("");

    Array.from(elements.historyList.querySelectorAll("[data-view-ticket]")).forEach(function (button) {
      button.addEventListener("click", function () {
        const booking = activeItems.find(function (item) {
          return item.bookingId === button.dataset.viewTicket;
        });
        if (booking) {
          state.ticket = booking;
          renderTicket(booking);
          showModal("ticketModal");
        }
      });
    });

    Array.from(elements.historyList.querySelectorAll("[data-cancel-booking]")).forEach(function (button) {
      button.addEventListener("click", function () {
        cancelBooking(button.dataset.cancelBooking);
      });
    });
  }

  function updateHistoryTabs() {
    elements.historyTabs.forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.historyTab === state.activeHistoryTab);
    });
  }

  function renderNextBooking() {
    const nextBooking = state.history.upcoming[0];
    if (!nextBooking) {
      elements.nextBookingPanel.classList.add("is-hidden");
      return;
    }

    elements.nextBookingTitle.textContent = nextBooking.slotLabel;
    elements.nextBookingText.textContent =
      formatDateLabel(nextBooking.date).longDate + " | " + nextBooking.center;
    elements.nextBookingPanel.classList.remove("is-hidden");
  }

  function openConfirmModal(slot) {
    state.pendingSlot = slot;
    elements.confirmDetails.innerHTML = [
      buildDetailItem("Student", state.student.name),
      buildDetailItem("Registration No.", state.student.regno),
      buildDetailItem("Center", state.student.center),
      buildDetailItem("Date", formatDateLabel(state.selectedDate).longDate),
      buildDetailItem("Slot", slot.label),
      buildDetailItem("Availability", slot.remaining + " of " + slot.capacity + " systems left")
    ].join("");
    showModal("confirmModal");
  }

  async function confirmBooking() {
    if (!state.pendingSlot || !state.student) {
      return;
    }

    setButtonLoading(elements.confirmBookingButton, true, "Booking...");

    try {
      const data = await apiPost("book", {
        regno: state.student.regno,
        date: state.selectedDate,
        slotKey: state.pendingSlot.slotKey
      });

      state.ticket = data.booking;
      hideModal("confirmModal");
      renderTicket(data.booking);
      showModal("ticketModal");
      await Promise.all([loadSlots(state.selectedDate), loadHistory()]);
      toast("Slot booked successfully.");
    } catch (error) {
      toast(error.message || "Booking failed.");
    } finally {
      setButtonLoading(elements.confirmBookingButton, false, "Book This Slot");
    }
  }

  async function cancelBooking(bookingId) {
    if (!window.confirm("Cancel this booking? This will immediately free the slot.")) {
      return;
    }

    try {
      await apiPost("cancel", {
        regno: state.student.regno,
        bookingId: bookingId
      });
      await Promise.all([loadSlots(state.selectedDate), loadHistory()]);
      toast("Booking cancelled.");
    } catch (error) {
      toast(error.message || "Cancellation failed.");
    }
  }

  function renderTicket(booking) {
    elements.ticketBookingId.textContent = booking.bookingId;
    elements.ticketDetails.innerHTML = [
      buildDetailItem("Student", booking.studentName),
      buildDetailItem("Registration No.", booking.regno),
      buildDetailItem("Center", booking.center),
      buildDetailItem("Course", booking.course),
      buildDetailItem("Date", formatDateLabel(booking.date).longDate),
      buildDetailItem("Slot", booking.slotLabel)
    ].join("");

    destroyQrCode();
    elements.ticketQr.innerHTML = "";

    if (window.QRCode) {
      const primaryPayload = buildTicketQrPayload(booking, false);
      const fallbackPayload = buildTicketQrPayload(booking, true);

      try {
        state.currentQrCode = createTicketQrCode(primaryPayload);
      } catch (error) {
        destroyQrCode();

        try {
          state.currentQrCode = createTicketQrCode(fallbackPayload);
          toast("QR code was simplified to fit the ticket.");
        } catch (secondaryError) {
          elements.ticketQr.innerHTML = '<p class="helper-copy">QR could not be generated. Use the booking ID shown above.</p>';
        }
      }
    } else {
      elements.ticketQr.innerHTML = '<p class="helper-copy">QR library could not be loaded.</p>';
    }
  }

  function createTicketQrCode(text) {
    return new window.QRCode(elements.ticketQr, {
      text: text,
      width: 160,
      height: 160,
      colorDark: "#111827",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.L,
      typeNumber: 20
    });
  }

  function buildTicketQrPayload(booking, compactOnly) {
    if (!compactOnly && booking.qrText) {
      return booking.qrText;
    }

    return [
      "ID:" + (booking.bookingId || "-"),
      "RG:" + (booking.regno || "-"),
      "DT:" + (booking.date || "-"),
      "SL:" + (booking.slotLabel || "-")
    ].join("|");
  }

  async function copyBookingId() {
    if (!state.ticket || !state.ticket.bookingId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(state.ticket.bookingId);
      toast("Booking ID copied.");
    } catch (error) {
      toast("Could not copy booking ID.");
    }
  }

  function destroyQrCode() {
    state.currentQrCode = null;
    if (elements.ticketQr) {
      elements.ticketQr.innerHTML = "";
    }
  }

  function buildSlotStat(label, value) {
    return (
      '<div class="slot-stat">' +
        "<span>" + escapeHtml(label) + "</span>" +
        "<strong>" + escapeHtml(String(value)) + "</strong>" +
      "</div>"
    );
  }

  function buildHistoryMeta(label, value) {
    return (
      '<div class="history-meta">' +
        "<span>" + escapeHtml(label) + "</span>" +
        "<strong>" + escapeHtml(value || "-") + "</strong>" +
      "</div>"
    );
  }

  function buildDetailItem(label, value) {
    return (
      '<div class="detail-item">' +
        "<span>" + escapeHtml(label) + "</span>" +
        "<strong>" + escapeHtml(value || "-") + "</strong>" +
      "</div>"
    );
  }

  function buildSkeletonCards(count) {
    return new Array(count).fill(0).map(function (_, index) {
      return (
        '<article class="slot-card" style="animation-delay:' + (index * 40) + 'ms">' +
          '<div class="slot-card-head">' +
            '<div><p class="slot-time">Loading slot...</p><span class="meta-label">Please wait</span></div>' +
            '<span class="status-pill status-muted">Loading</span>' +
          "</div>" +
          '<div class="slot-stats">' +
            buildSlotStat("Available", "-") +
            buildSlotStat("Booked", "-") +
            buildSlotStat("Occupancy", "-") +
          "</div>" +
          '<div class="slot-progress"><span style="width:18%"></span></div>' +
        "</article>"
      );
    }).join("");
  }

  function getHistoryStatusLabel(booking) {
    if (booking.status === "CANCELLED") {
      return "Cancelled";
    }
    if (state.activeHistoryTab === "past") {
      return "Completed";
    }
    return "Booked";
  }

  function getStatusClass(status, isPositive) {
    if (status === "CANCELLED" || status === "Fully Booked") {
      return "status-danger";
    }
    if (!isPositive) {
      return "status-muted";
    }
    if (status === "Few Systems Left") {
      return "status-warning";
    }
    return "status-available";
  }

  async function apiGet(action, params) {
    const url = new URL(API_BASE_URL);
    url.searchParams.set("action", action);
    url.searchParams.set("_ts", String(Date.now()));
    Object.keys(params || {}).forEach(function (key) {
      url.searchParams.set(key, params[key]);
    });

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      credentials: "omit"
    });

    const data = await handleApiResponse(response);
    applyServerClock(data);
    return data;
  }

  async function apiPost(action, payload) {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      body: new URLSearchParams(Object.assign({ action: action }, payload || {})),
      credentials: "omit"
    });

    const data = await handleApiResponse(response);
    applyServerClock(data);
    return data;
  }

  async function handleApiResponse(response) {
    let data;

    try {
      data = await response.json();
    } catch (error) {
      throw new Error("The backend did not return valid JSON.");
    }

    if (!response.ok || !data.ok) {
      const message = data && data.error && data.error.message ? data.error.message : "Request failed.";
      throw new Error(message);
    }

    return data;
  }

  function showModal(id) {
    document.getElementById(id).classList.remove("is-hidden");
  }

  function hideModal(id) {
    document.getElementById(id).classList.add("is-hidden");
    if (id === "confirmModal") {
      state.pendingSlot = null;
    }
  }

  function setButtonLoading(button, isLoading, label) {
    button.disabled = isLoading;
    button.textContent = label;
  }

  function toast(message) {
    const toastNode = document.createElement("div");
    toastNode.className = "toast";
    toastNode.textContent = message;
    elements.toastRegion.appendChild(toastNode);

    window.setTimeout(function () {
      toastNode.remove();
    }, 3200);
  }

  function isApiConfigured() {
    return API_BASE_URL && API_BASE_URL.indexOf("PASTE_APPS_SCRIPT_WEB_APP_URL_HERE") === -1;
  }

  function applyServerClock(payload) {
    if (!payload || typeof payload !== "object") {
      return;
    }

    if (payload.serverTodayKey) {
      state.serverTodayKey = payload.serverTodayKey;
    }

    if (payload.serverNowIso) {
      state.serverNowIso = payload.serverNowIso;
    }
  }

  function normalizeRegno(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 8);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getIstTodayKey() {
    const parts = getDatePartsInTimeZone(new Date(), TIMEZONE);
    return [parts.year, parts.month, parts.day].join("-");
  }

  function addDaysToDateKey(dateKey, amount) {
    const date = new Date(dateKey + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + amount);
    return formatDateKeyFromUtcDate(date);
  }

  function formatDateKeyFromUtcDate(date) {
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return [year, month, day].join("-");
  }

  function formatDateLabel(dateKey) {
    const date = parseDateOnlyValue(dateKey);
    if (!date) {
      return {
        longDate: String(dateKey || "-"),
        shortDay: "Date unavailable"
      };
    }

    const longFormatter = new Intl.DateTimeFormat("en-IN", {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    const shortDayFormatter = new Intl.DateTimeFormat("en-IN", {
      timeZone: "UTC",
      weekday: "long"
    });

    return {
      longDate: longFormatter.format(date),
      shortDay: shortDayFormatter.format(date)
    };
  }

  function formatDateTimeLabel(value) {
    const date = parseDateTimeValue(value);
    if (!date) {
      return "-";
    }

    return new Intl.DateTimeFormat("en-IN", {
      timeZone: TIMEZONE,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function parseDateOnlyValue(value) {
    if (!value) {
      return null;
    }

    const raw = String(value).trim();
    const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      return new Date(Date.UTC(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3])
      ));
    }

    const parsed = parseDateTimeValue(raw);
    if (!parsed) {
      return null;
    }

    const parts = getDatePartsInTimeZone(parsed, TIMEZONE);
    return new Date(Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day)
    ));
  }

  function parseDateTimeValue(value) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function getDatePartsInTimeZone(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-IN", {
      timeZone: timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);

    return parts.reduce(function (map, part) {
      if (part.type === "year" || part.type === "month" || part.type === "day") {
        map[part.type] = part.value;
      }
      return map;
    }, {});
  }

  function clampPercent(value) {
    const numeric = Number(value) || 0;
    return Math.max(0, Math.min(100, numeric));
  }
})();
