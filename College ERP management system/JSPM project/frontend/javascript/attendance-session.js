/**
 * Jayawantrao Sawant Polytechnic — Take Today's Attendance (session screen)
 * -------------------------------------------------------------------------
 * Pure vanilla JS. No framework, no backend logic — this file only talks
 * to the backend through the two clearly-marked fetch() functions below.
 *
 * File map:
 *   1. CONFIG / MOCK DATA   — swap these out once Shivraj's API is ready
 *   2. STATE                — single source of truth for the whole screen
 *   3. API LAYER            — fetchStudents() / submitAttendanceToServer()
 *   4. RENDER FUNCTIONS     — read state, write DOM (one-way data flow)
 *   5. EVENT HANDLERS       — user actions, mutate state, then re-render
 *   6. INIT                 — boots the whole thing on page load
 * -------------------------------------------------------------------------
 */

(() => {
  'use strict';

  /* =========================================================================
     1. CONFIG / MOCK DATA
     These two flags/objects are the ONLY things that should need to change
     when Shivraj's real FastAPI endpoints are ready.
     ========================================================================= */

  // TODO: Replace with Shivraj's actual API endpoint and response format.
  const API_CONFIG = {
    // Expected to return: { session: {...}, students: [{ student_id, roll_no, name }, ...] }
    GET_STUDENTS_URL: '/api/attendance/session/STUB_SESSION_ID/students',
    // Expected to accept: { session_id, attendance: [{ student_id, status }, ...] }
    SUBMIT_ATTENDANCE_URL: '/api/attendance/submit'
  };

  // Set this to false the moment a real backend is reachable.
  // Everything in this block can be deleted without touching any other code.
  const USE_MOCK_DATA = true;

  const MOCK_SESSION = {
    department: 'Computer Engineering',
    year: 'Second Year',
    className: 'SYCO2',
    subject: 'Data Structures (DSU)'
  };

  const MOCK_STUDENTS = [
    { student_id: 1, roll_no: '01', name: 'Rahul Patil' },
    { student_id: 2, roll_no: '02', name: 'Sneha Kulkarni' },
    { student_id: 3, roll_no: '03', name: 'Aditya More' },
    { student_id: 4, roll_no: '04', name: 'Priya Deshmukh' },
    { student_id: 5, roll_no: '05', name: 'Omkar Jadhav' },
    { student_id: 6, roll_no: '06', name: 'Sarthak Dhappadhule' },
    { student_id: 7, roll_no: '07', name: 'Anjali Shinde' },
    { student_id: 8, roll_no: '08', name: 'Yash Kale' }
  ];

  /* =========================================================================
     2. STATE
     One object, one place. Every render function reads from here; every
     event handler writes here and then calls a render function. Nothing
     else touches the DOM directly.
     ========================================================================= */

  const state = {
    session: null,       // { department, year, className, subject }
    students: [],        // [{ student_id, roll_no, name }, ...]
    currentIndex: 0,      // which student is currently shown
    attendance: {},       // { [student_id]: 'present' | 'absent' }
    screen: 'loading',    // 'loading' | 'error' | 'empty' | 'marking' | 'summary' | 'review'
    loadError: null
  };

  /* =========================================================================
     3. API LAYER
     Both functions are isolated so the mock branch can be deleted cleanly.
     ========================================================================= */

  async function fetchStudents() {
    if (USE_MOCK_DATA) {
      // Simulate network latency so the loading state is visible in dev.
      await wait(500);
      return { session: MOCK_SESSION, students: MOCK_STUDENTS };
    }

    // TODO: Replace with Shivraj's actual API endpoint and response format.
    const response = await fetch(API_CONFIG.GET_STUDENTS_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to load students (status ${response.status})`);
    }

    return response.json(); // expected shape: { session, students }
  }

  async function submitAttendanceToServer(payload) {
    if (USE_MOCK_DATA) {
      await wait(600);
      console.log('[MOCK SUBMIT] Attendance payload:', payload);
      return { ok: true };
    }

    // TODO: Replace with Shivraj's actual API endpoint and response format.
    const response = await fetch(API_CONFIG.SUBMIT_ATTENDANCE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Submission failed (status ${response.status})`);
    }

    return response.json();
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* =========================================================================
     4. RENDER FUNCTIONS
     ========================================================================= */

  const el = {
    sessionLabel: document.querySelector('[data-session-label]'),
    screens: {
      loading: document.querySelector('[data-screen="loading"]'),
      error: document.querySelector('[data-screen="error"]'),
      empty: document.querySelector('[data-screen="empty"]'),
      marking: document.querySelector('[data-screen="marking"]'),
      summary: document.querySelector('[data-screen="summary"]'),
      review: document.querySelector('[data-screen="review"]')
    },
    errorMessage: document.querySelector('[data-error-message]'),
    progressLabel: document.querySelector('[data-progress-label]'),
    progressFill: document.querySelector('[data-progress-fill]'),
    counter: document.querySelector('[data-counter]'),
    avatarInitial: document.querySelector('[data-avatar-initial]'),
    rollNo: document.querySelector('[data-roll-no]'),
    studentName: document.querySelector('[data-student-name]'),
    presentBtn: document.querySelector('[data-mark-present]'),
    absentBtn: document.querySelector('[data-mark-absent]'),
    prevBtn: document.querySelector('[data-prev-student]'),
    presentCount: document.querySelector('[data-present-count]'),
    absentCount: document.querySelector('[data-absent-count]'),
    totalCount: document.querySelector('[data-total-count]'),
    reviewList: document.querySelector('[data-review-list]'),
    toast: document.querySelector('[data-toast]')
  };

  function showScreen(name) {
    state.screen = name;
    Object.entries(el.screens).forEach(([key, node]) => {
      if (!node) return;
      node.hidden = key !== name;
    });
  }

  function renderSessionLabel() {
    if (!el.sessionLabel || !state.session) return;
    const { className, subject } = state.session;
    el.sessionLabel.textContent = `${className} — ${subject}`;
  }

  function renderProgress() {
    const total = state.students.length;
    const completed = Object.keys(state.attendance).length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    if (el.progressLabel) {
      el.progressLabel.innerHTML = `<strong>${completed} / ${total}</strong> students completed`;
    }
    if (el.progressFill) {
      el.progressFill.style.width = `${percent}%`;
    }
  }

  function renderCurrentStudent() {
    const student = state.students[state.currentIndex];
    if (!student) return;

    const total = state.students.length;
    const position = state.currentIndex + 1;

    if (el.counter) el.counter.textContent = `Student ${position} of ${total}`;
    if (el.rollNo) el.rollNo.textContent = `Roll No: ${student.roll_no}`;
    if (el.studentName) el.studentName.textContent = student.name;
    if (el.avatarInitial) el.avatarInitial.textContent = student.name.charAt(0).toUpperCase();

    // Reflect any existing status for this student (relevant when using Back).
    const existingStatus = state.attendance[student.student_id];
    setChoiceButtonState(existingStatus);

    if (el.prevBtn) el.prevBtn.disabled = state.currentIndex === 0;

    renderProgress();
  }

  function setChoiceButtonState(status) {
    if (!el.presentBtn || !el.absentBtn) return;
    el.presentBtn.classList.toggle('is-selected', status === 'present');
    el.absentBtn.classList.toggle('is-selected', status === 'absent');
  }

  function renderSummary() {
    const counts = getAttendanceCounts();
    if (el.presentCount) el.presentCount.textContent = counts.present;
    if (el.absentCount) el.absentCount.textContent = counts.absent;
    if (el.totalCount) el.totalCount.textContent = state.students.length;
  }

  function renderReviewList() {
    if (!el.reviewList) return;
    el.reviewList.innerHTML = '';

    state.students.forEach((student) => {
      const status = state.attendance[student.student_id];

      const row = document.createElement('div');
      row.className = 'as-review-row';
      row.innerHTML = `
        <div class="as-review-row__info">
          <div class="as-review-row__name">${escapeHtml(student.name)}</div>
          <div class="as-review-row__roll">Roll No: ${escapeHtml(student.roll_no)}</div>
        </div>
        <div class="as-review-row__toggle">
          <button type="button"
                  class="as-review-toggle-btn as-review-toggle-btn--present ${status === 'present' ? 'is-active' : ''}"
                  data-review-set="${student.student_id}" data-review-status="present">
            Present
          </button>
          <button type="button"
                  class="as-review-toggle-btn as-review-toggle-btn--absent ${status === 'absent' ? 'is-active' : ''}"
                  data-review-set="${student.student_id}" data-review-status="absent">
            Absent
          </button>
        </div>
      `;
      el.reviewList.appendChild(row);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(message, isError = false) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.classList.toggle('is-error', isError);
    el.toast.classList.add('is-visible');
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      el.toast.classList.remove('is-visible');
    }, 2800);
  }

  /* =========================================================================
     5. EVENT HANDLERS
     ========================================================================= */

  function getAttendanceCounts() {
    let present = 0;
    let absent = 0;
    Object.values(state.attendance).forEach((status) => {
      if (status === 'present') present += 1;
      if (status === 'absent') absent += 1;
    });
    return { present, absent };
  }

  function isAttendanceComplete() {
    return state.students.length > 0 &&
      state.students.every((student) => state.attendance[student.student_id]);
  }

  function markAttendance(status) {
    const student = state.students[state.currentIndex];
    if (!student) return;

    // Store immediately — this is what makes "Back" safe. Re-marking a
    // student just overwrites their entry in this map.
    state.attendance[student.student_id] = status;
    setChoiceButtonState(status);
    renderProgress();

    // Briefly disable both buttons so a double-click can't register two
    // statuses or skip the confirmation moment, then advance.
    el.presentBtn.disabled = true;
    el.absentBtn.disabled = true;

    window.setTimeout(() => {
      el.presentBtn.disabled = false;
      el.absentBtn.disabled = false;
      advanceToNext();
    }, 450);
  }

  function advanceToNext() {
    const isLastStudent = state.currentIndex >= state.students.length - 1;

    if (isLastStudent) {
      renderSummary();
      showScreen('summary');
      return;
    }

    state.currentIndex += 1;
    renderCurrentStudent();
  }

  function goToPreviousStudent() {
    if (state.currentIndex === 0) return;
    state.currentIndex -= 1;
    renderCurrentStudent();
  }

  function openReview() {
    renderReviewList();
    showScreen('review');
  }

  function handleReviewToggleClick(event) {
    const button = event.target.closest('[data-review-set]');
    if (!button) return;

    const studentId = Number(button.getAttribute('data-review-set'));
    const status = button.getAttribute('data-review-status');
    state.attendance[studentId] = status;
    renderReviewList();
  }

  function backToSummaryFromReview() {
    renderSummary();
    showScreen('summary');
  }

  /* -------------------------------------------------------------------------
     Converts the internal { [student_id]: status } map into the array shape
     the backend expects. This is the ONLY place that needs to change if
     Shivraj's real contract differs from the example in the brief.
     ------------------------------------------------------------------------- */
  function buildAttendancePayload() {
    return {
      // TODO: confirm actual session identifier field name with Shivraj.
      session_id: 'STUB_SESSION_ID',
      attendance: state.students.map((student) => ({
        student_id: student.student_id,
        status: state.attendance[student.student_id]
      }))
    };
  }

  async function handleSubmitAttendance() {
    if (!isAttendanceComplete()) {
      showToast('Please mark attendance for every student before submitting.', true);
      return;
    }

    const submitButtons = document.querySelectorAll('[data-submit-attendance]');
    submitButtons.forEach((btn) => {
      btn.disabled = true;
      btn.textContent = 'Submitting…';
    });

    try {
      const payload = buildAttendancePayload();
      await submitAttendanceToServer(payload);
      showToast('Attendance submitted successfully.');
    } catch (error) {
      console.error('Attendance submission failed:', error);
      showToast('Could not submit attendance. Please try again.', true);
    } finally {
      submitButtons.forEach((btn) => {
        btn.disabled = false;
        btn.textContent = 'Submit Attendance';
      });
    }
  }

  /* =========================================================================
     6. INIT
     ========================================================================= */

  async function init() {
    showScreen('loading');

    try {
      const data = await fetchStudents();
      state.session = data.session || null;
      state.students = Array.isArray(data.students) ? data.students : [];
      state.currentIndex = 0;
      state.attendance = {};

      renderSessionLabel();

      if (state.students.length === 0) {
        showScreen('empty');
        return;
      }

      showScreen('marking');
      renderCurrentStudent();
    } catch (error) {
      console.error('Failed to load attendance session:', error);
      state.loadError = error.message || 'Something went wrong.';
      if (el.errorMessage) el.errorMessage.textContent = state.loadError;
      showScreen('error');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    init();

    if (el.presentBtn) el.presentBtn.addEventListener('click', () => markAttendance('present'));
    if (el.absentBtn) el.absentBtn.addEventListener('click', () => markAttendance('absent'));
    if (el.prevBtn) el.prevBtn.addEventListener('click', goToPreviousStudent);
    if (el.reviewList) el.reviewList.addEventListener('click', handleReviewToggleClick);

    const retryBtn = document.querySelector('[data-retry-load]');
    if (retryBtn) retryBtn.addEventListener('click', init);

    const reviewBtn = document.querySelector('[data-open-review]');
    if (reviewBtn) reviewBtn.addEventListener('click', openReview);

    const backToSummaryBtn = document.querySelector('[data-back-to-summary]');
    if (backToSummaryBtn) backToSummaryBtn.addEventListener('click', backToSummaryFromReview);

    const submitButtons = document.querySelectorAll('[data-submit-attendance]');
    submitButtons.forEach((btn) => btn.addEventListener('click', handleSubmitAttendance));
  });
})();
