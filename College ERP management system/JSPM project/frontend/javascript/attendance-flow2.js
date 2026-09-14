/**
 * Jayawantrao Sawant Polytechnic — Faculty Attendance Flow
 * Connected to Shivraj's FastAPI Backend
 */

(() => {
  'use strict';

  /* =========================================================================
     1. API CONFIGURATION
     Points directly to your FastAPI backend server.
     ========================================================================= */

  // Set to false to interact with live Uvicorn backend
  const USE_MOCK_DATA = false;

  const API_CONFIG = {
    BASE_URL: 'http://127.0.0.1:8000',
    SUBMIT_ATTENDANCE_URL: 'http://127.0.0.1:8000/attendance/mark'
  };

  function getTeacherPhone() {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('phone') ||
      localStorage.getItem('jspmTeacherPhone') ||
      ''
    ).trim();
  }

  function getLiveSessionUrl() {
    const phone = getTeacherPhone();
    if (!phone) {
      throw new Error('Teacher phone number is missing. Open attendance.html?phone=YOUR_PHONE or save jspmTeacherPhone in localStorage.');
    }
    return `${API_CONFIG.BASE_URL}/teachers/by-phone/${encodeURIComponent(phone)}/active-slot`;
  }

  /* =========================================================================
     2. MOCK DATA
     ========================================================================= */

  const MOCK_LIVE_SESSION_RESPONSE = {
    has_active_class: true,
    teacher: { teacher_id: 1, name: "Prof. Sharma" },
    slot_info: {
      timetable_id: 1,
      subject_code: "DSU",
      class_name: "SYCO2",
      start_time: "11:00 AM",
      end_time: "01:00 PM"
    },
    students: [
      { student_id: 1, roll_no: "01", name: "Rahul Patil" },
      { student_id: 2, roll_no: "02", name: "Sneha Kulkarni" },
      { student_id: 3, roll_no: "03", name: "Aditya More" }
    ]
  };

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* =========================================================================
     3. STATE
     ========================================================================= */

  const state = {
    liveSession: null,   
    students: [],        
    currentIndex: 0,
    attendance: {},       // { [student_id]: 'PRESENT' | 'ABSENT' }
    screen: 'loading'     
  };

  /* =========================================================================
     4. API FUNCTIONS + RESPONSE MAPPING
     ========================================================================= */

  async function fetchLiveSession() {
    let raw;

    if (USE_MOCK_DATA) {
      await wait(400);
      raw = MOCK_LIVE_SESSION_RESPONSE;
    } else {
      const response = await fetch(getLiveSessionUrl(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to load live session (status ${response.status})`);
      }

      raw = await response.json();
    }

    return mapLiveSessionResponse(raw);
  }

  function mapLiveSessionResponse(raw) {
    if (!raw || raw.has_active_class !== true) {
      return { isLive: false };
    }

    return {
      isLive: true,
      sessionId: raw.slot_info.timetable_id,
      teacherId: raw.teacher ? raw.teacher.teacher_id : null,
      teacherName: raw.teacher ? raw.teacher.name : '—',
      department: raw.slot_info.department || 'Computer Engineering',
      year: 'Second Year',
      className: raw.slot_info.class_name,
      subject: raw.slot_info.subject_code,
      type: raw.slot_info.slot_type || 'LECTURE',
      batch: raw.slot_info.target_batch || 'ALL',
      startTime: raw.slot_info.start_time,
      endTime: raw.slot_info.end_time,
      rawStudents: raw.students || []
    };
  }

  async function fetchStudentsForSession(sessionId) {
    if (USE_MOCK_DATA) {
      await wait(400);
      return mapStudentsResponse(MOCK_LIVE_SESSION_RESPONSE.students);
    }

    // Retreives student payload pre-loaded from live session endpoint
    if (state.liveSession && state.liveSession.rawStudents) {
      return mapStudentsResponse(state.liveSession.rawStudents);
    }

    return [];
  }

  function mapStudentsResponse(rawList) {
    const list = Array.isArray(rawList) ? rawList : [];
    return list.map((student) => ({
      studentId: student.student_id,
      rollNo: student.roll_no,
      name: student.name
    }));
  }

  async function submitAttendanceToServer(payload) {
    if (USE_MOCK_DATA) {
      await wait(500);
      console.log('[MOCK SUBMIT] Attendance payload:', payload);
      return { ok: true };
    }

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

  /* =========================================================================
     5. DOM REFERENCES
     ========================================================================= */

  const el = {
    loadingScreen: document.querySelector('[data-loading-screen]'),
    liveScreen: document.querySelector('[data-live-screen]'),
    noLiveScreen: document.querySelector('[data-no-live-screen]'),
    liveErrorScreen: document.querySelector('[data-live-error-screen]'),
    liveErrorMessage: document.querySelector('[data-live-error-message]'),
    markingScreen: document.querySelector('[data-marking-screen]'),
    studentsEmptyScreen: document.querySelector('[data-students-empty-screen]'),
    studentsErrorScreen: document.querySelector('[data-students-error-screen]'),
    studentsErrorMessage: document.querySelector('[data-students-error-message]'),
    summaryScreen: document.querySelector('[data-summary-screen]'),
    reviewScreen: document.querySelector('[data-review-screen]'),

    liveSubject: document.querySelector('[data-live-subject]'),
    liveType: document.querySelector('[data-live-type]'),
    liveBatch: document.querySelector('[data-live-batch]'),
    liveTime: document.querySelector('[data-live-time]'),
    liveClass: document.querySelector('[data-live-class]'),
    takeAttendanceBtn: document.querySelector('[data-take-attendance-btn]'),
    retryLiveBtn: document.querySelector('[data-retry-live]'),

    counter: document.querySelector('[data-counter]'),
    rollNo: document.querySelector('[data-roll-no]'),
    studentName: document.querySelector('[data-student-name]'),
    progressLabel: document.querySelector('[data-progress-label]'),
    progressFill: document.querySelector('[data-progress-fill]'),
    presentBtn: document.querySelector('[data-mark-present]'),
    absentBtn: document.querySelector('[data-mark-absent]'),
    prevBtn: document.querySelector('[data-prev-student]'),

    presentCount: document.querySelector('[data-present-count]'),
    absentCount: document.querySelector('[data-absent-count]'),
    totalCount: document.querySelector('[data-total-count]'),
    openReviewBtn: document.querySelector('[data-open-review]'),

    reviewList: document.querySelector('[data-review-list]'),
    backToSummaryBtn: document.querySelector('[data-back-to-summary]'),

    submitButtons: document.querySelectorAll('[data-submit-attendance]'),
    toast: document.querySelector('[data-toast]')
  };

  /* =========================================================================
     6. RENDERING FUNCTIONS
     ========================================================================= */

  const ALL_SCREENS = [
    'loadingScreen', 'liveScreen', 'noLiveScreen', 'liveErrorScreen',
    'markingScreen', 'studentsEmptyScreen', 'studentsErrorScreen',
    'summaryScreen', 'reviewScreen'
  ];

  function showScreen(screenKey) {
    state.screen = screenKey;
    ALL_SCREENS.forEach((key) => {
      const node = el[key];
      if (!node) return;
      node.hidden = key !== screenKey;
    });
  }

  function renderLiveSession() {
    const session = state.liveSession;
    if (!session || !session.isLive) return;

    if (el.liveSubject) el.liveSubject.textContent = session.subject || '';
    if (el.liveType) el.liveType.textContent = session.type || '';
    if (el.liveClass) el.liveClass.textContent = session.className || '';
    if (el.liveTime) el.liveTime.textContent = `${session.startTime || ''} – ${session.endTime || ''}`;

    if (el.liveBatch) {
      if (session.type && session.type.toLowerCase() === 'practical' && session.batch) {
        el.liveBatch.textContent = `Batch ${session.batch}`;
        el.liveBatch.hidden = false;
      } else {
        el.liveBatch.textContent = '';
        el.liveBatch.hidden = true;
      }
    }
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
    if (el.rollNo) el.rollNo.textContent = `Roll No: ${student.rollNo}`;
    if (el.studentName) el.studentName.textContent = student.name;

    const existingStatus = state.attendance[student.studentId];
    setChoiceButtonState(existingStatus);

    if (el.prevBtn) el.prevBtn.disabled = state.currentIndex === 0;

    renderProgress();
  }

  function setChoiceButtonState(status) {
    if (el.presentBtn) el.presentBtn.classList.toggle('is-selected', status === 'PRESENT');
    if (el.absentBtn) el.absentBtn.classList.toggle('is-selected', status === 'ABSENT');
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
      const status = state.attendance[student.studentId];

      const row = document.createElement('div');
      row.className = 'as-review-row';
      row.innerHTML = `
        <div class="as-review-row__info">
          <div class="as-review-row__name">${escapeHtml(student.name)}</div>
          <div class="as-review-row__roll">Roll No: ${escapeHtml(student.rollNo)}</div>
        </div>
        <div class="as-review-row__toggle">
          <button type="button"
                  class="as-review-toggle-btn as-review-toggle-btn--present ${status === 'PRESENT' ? 'is-active' : ''}"
                  data-review-set="${student.studentId}" data-review-status="PRESENT">
            Present
          </button>
          <button type="button"
                  class="as-review-toggle-btn as-review-toggle-btn--absent ${status === 'ABSENT' ? 'is-active' : ''}"
                  data-review-set="${student.studentId}" data-review-status="ABSENT">
            Absent
          </button>
        </div>
      `;
      el.reviewList.appendChild(row);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
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
     7. ATTENDANCE LOGIC
     ========================================================================= */

  function getAttendanceCounts() {
    let present = 0;
    let absent = 0;
    Object.values(state.attendance).forEach((status) => {
      if (status === 'PRESENT') present += 1;
      if (status === 'ABSENT') absent += 1;
    });
    return { present, absent };
  }

  function isAttendanceComplete() {
    return state.students.length > 0 &&
      state.students.every((student) => Boolean(state.attendance[student.studentId]));
  }

  function markAttendance(status) {
    const student = state.students[state.currentIndex];
    if (!student) return;

    state.attendance[student.studentId] = status;
    setChoiceButtonState(status);
    renderProgress();

    if (el.presentBtn) el.presentBtn.disabled = true;
    if (el.absentBtn) el.absentBtn.disabled = true;

    window.setTimeout(() => {
      if (el.presentBtn) el.presentBtn.disabled = false;
      if (el.absentBtn) el.absentBtn.disabled = false;
      advanceToNext();
    }, 450);
  }

  function advanceToNext() {
    const isLastStudent = state.currentIndex >= state.students.length - 1;

    if (isLastStudent) {
      renderSummary();
      showScreen('summaryScreen');
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

  /* =========================================================================
     8. REVIEW LOGIC
     ========================================================================= */

  function openReview() {
    renderReviewList();
    showScreen('reviewScreen');
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
    showScreen('summaryScreen');
  }

  /* =========================================================================
     9. SUBMISSION (Pydantic Schema Alignment)
     ========================================================================= */

  function buildAttendancePayload() {
    return {
      timetable_id: state.liveSession ? state.liveSession.sessionId : null,
      date: new Date().toISOString().slice(0, 10),
      attendance_list: state.students.map((student) => ({
        student_id: student.studentId,
        status: (state.attendance[student.studentId] || 'ABSENT').toUpperCase()
      }))
    };
  }

  async function handleSubmitAttendance() {
    if (!isAttendanceComplete()) {
      showToast('Please mark attendance for every student before submitting.', true);
      return;
    }

    el.submitButtons.forEach((btn) => {
      btn.disabled = true;
      btn.textContent = 'Submitting…';
    });

    try {
      const payload = buildAttendancePayload();
      await submitAttendanceToServer(payload);
      showToast('Attendance stored in logs successfully!');
    } catch (error) {
      console.error('Attendance submission failed:', error);
      showToast('Could not submit attendance. Please try again.', true);
    } finally {
      el.submitButtons.forEach((btn) => {
        btn.disabled = false;
        btn.textContent = 'Submit Attendance';
      });
    }
  }

  /* =========================================================================
     10. INITIALIZATION
     ========================================================================= */

  async function loadLiveSession() {
    showScreen('loadingScreen');

    try {
      const session = await fetchLiveSession();
      state.liveSession = session;

      if (!session.isLive) {
        showScreen('noLiveScreen');
        return;
      }

      renderLiveSession();
      showScreen('liveScreen');
    } catch (error) {
      console.error('Failed to load live session:', error);
      if (el.liveErrorMessage) {
        el.liveErrorMessage.textContent = error.message || 'Something went wrong.';
      }
      showScreen('liveErrorScreen');
    }
  }

  async function startAttendanceSession() {
    if (!state.liveSession || !state.liveSession.isLive || !state.liveSession.sessionId) {
      showToast('No active session found. Please refresh and try again.', true);
      return;
    }

    showScreen('loadingScreen');

    try {
      const students = await fetchStudentsForSession(state.liveSession.sessionId);
      state.students = students;
      state.currentIndex = 0;
      state.attendance = {};

      if (students.length === 0) {
        showScreen('studentsEmptyScreen');
        return;
      }

      showScreen('markingScreen');
      renderCurrentStudent();
    } catch (error) {
      console.error('Failed to load students:', error);
      if (el.studentsErrorMessage) {
        el.studentsErrorMessage.textContent = error.message || 'Something went wrong.';
      }
      showScreen('studentsErrorScreen');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadLiveSession();

    if (el.retryLiveBtn) el.retryLiveBtn.addEventListener('click', loadLiveSession);
    if (el.takeAttendanceBtn) el.takeAttendanceBtn.addEventListener('click', startAttendanceSession);

    if (el.presentBtn) el.presentBtn.addEventListener('click', () => markAttendance('PRESENT'));
    if (el.absentBtn) el.absentBtn.addEventListener('click', () => markAttendance('ABSENT'));
    if (el.prevBtn) el.prevBtn.addEventListener('click', goToPreviousStudent);

    if (el.openReviewBtn) el.openReviewBtn.addEventListener('click', openReview);
    if (el.reviewList) el.reviewList.addEventListener('click', handleReviewToggleClick);
    if (el.backToSummaryBtn) el.backToSummaryBtn.addEventListener('click', backToSummaryFromReview);

    el.submitButtons.forEach((btn) => btn.addEventListener('click', handleSubmitAttendance));
  });
})();