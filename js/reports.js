/* Reports module - daily list of borrow and return transactions with an
   automatic PHP 10 per late day penalty column, calendar date filter and printable layout. */

const REPORT_PENALTY_PER_DAY = 10;
const REPORT_DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const REPORT_MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

let reportSeedRecords = null;
const reportState = { date: null, type: 'all' };

function getReportToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

function shiftReportDay(offsetDays) {
    const base = reportState.date instanceof Date ? reportState.date : getReportToday();
    const date = new Date(base.getTime());
    date.setDate(date.getDate() + offsetDays);
    return date;
}

function getReportDayOffset(offsetDays) {
    const date = getReportToday();
    date.setDate(date.getDate() + offsetDays);
    return date;
}

function isSameReportDay(first, second) {
    if (!(first instanceof Date) || !(second instanceof Date)) return false;
    return first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate();
}

function parseReportStoredDate(value) {
    if (value instanceof Date) return value;
    if (!value) return null;
    const cleaned = String(value).replace(/\(today\)/i, '').replace(/,/g, ' ').trim();
    if (!cleaned || cleaned === '—') return null;
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 3 && typeof REPORT_MONTHS[parts[0]] === 'number') {
        const day = Number(parts[1]);
        const year = Number(parts[2]);
        if (!Number.isNaN(day) && !Number.isNaN(year)) return new Date(year, REPORT_MONTHS[parts[0]], day);
    }
    const fallback = new Date(cleaned);
    return isNaN(fallback.getTime()) ? null : fallback;
}

function toReportInputValue(date) {
    if (!(date instanceof Date)) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + day;
}

function formatReportDate(value) {
    const date = parseReportStoredDate(value);
    if (!date) return '—';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatReportDateWithWeekday(value) {
    const date = parseReportStoredDate(value);
    if (!date) return '—';
    return formatReportDate(date) + ' - ' + REPORT_DAY_LABELS[date.getDay()];
}

function formatReportDateLabel(value) {
    const date = parseReportStoredDate(value);
    if (!date) return '—';
    const label = formatReportDate(date);
    return isSameReportDay(date, getReportToday()) ? label + ' (Today)' : label;
}

function formatReportPeso(amount) {
    return '\u20B1' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getReportLateDays(dueDate, returnDate) {
    if (!(dueDate instanceof Date) || !(returnDate instanceof Date)) return 0;
    return Math.max(0, Math.round((returnDate.getTime() - dueDate.getTime()) / 86400000));
}

const REPORT_BORROWER_POOL = [
    'Ana Reyes', 'Mark Santos', 'Jessa Lim', 'Paul Cruz', 'Mika Flores',
    'David Kim', 'Elena Rostova', 'Carlos Vance', 'Clara Oswald', 'Erin Rainer',
    'Elena Petrova', 'Robert Chen', 'Maria Santos', 'Nina Alvarez', 'Paolo Reyes'
];

const REPORT_BOOK_POOL = [
    'Database Systems: Complete Guide', 'Modern Web Development', 'Computer Networking Basics',
    'Information Security Essentials', 'Introduction to OOP Programming', 'Artificial Intelligence: A Modern Approach',
    'Abstract Algebra & Applications', 'Organic Chemistry 101', 'Fundamentals of Quantum Mechanics',
    'Data Structures & Algorithms in Java', 'Operating System Concepts', 'Clean Code',
    'Software Engineering: A Practitioner Approach', 'Fundamentals of Physics', 'Philippine Constitutional Law'
];

const REPORT_BORROW_PLAN = [6, 5, 4, 5, 4, 3]; // day offsets 0, -1, -2, -3, -4, -5 (6-day circulation chart)
const REPORT_RETURN_PLAN = [5, 4, 3, 4, 3, 3];
const REPORT_RETURN_LATE_POOL = [0, 2, 0, 5, 1, 3, 0, 4, 0, 6, 2, 0, 7, 1, 0, 3];
const REPORT_CONDITION_POOL = ['Good', 'Good', 'Minor Wear', 'Torn Cover', 'Good', 'Damaged Spine', 'Good', 'Minor Wear'];

function buildReportSeedRecords() {
    const records = [];
    let sequence = 0;
    REPORT_BORROW_PLAN.forEach((count, dayIndex) => {
        const borrowDate = getReportDayOffset(-dayIndex);
        for (let i = 0; i < count; i += 1) {
            const due = new Date(borrowDate.getTime());
            due.setDate(due.getDate() + 14);
            records.push({
                type: 'borrow',
                id: 'TX-' + (9840 - sequence * 4),
                borrower: REPORT_BORROWER_POOL[(sequence + dayIndex) % REPORT_BORROWER_POOL.length],
                bookTitle: REPORT_BOOK_POOL[(sequence * 2 + dayIndex) % REPORT_BOOK_POOL.length],
                borrowDate: borrowDate,
                dueDate: due,
                returnDate: null,
                date: borrowDate,
                penalty: 0
            });
            sequence += 1;
        }
    });

    let returnSequence = 0;
    REPORT_RETURN_PLAN.forEach((count, dayIndex) => {
        const returnDate = getReportDayOffset(-dayIndex);
        for (let i = 0; i < count; i += 1) {
            const lateDays = REPORT_RETURN_LATE_POOL[returnSequence % REPORT_RETURN_LATE_POOL.length];
            const due = new Date(returnDate.getTime());
            due.setDate(due.getDate() - lateDays);
            const borrowDate = new Date(due.getTime());
            borrowDate.setDate(borrowDate.getDate() - 14);
            records.push({
                type: 'return',
                id: 'RET-' + (9630 - returnSequence * 3),
                borrower: REPORT_BORROWER_POOL[(returnSequence + 5) % REPORT_BORROWER_POOL.length],
                bookTitle: REPORT_BOOK_POOL[(returnSequence * 2 + 3) % REPORT_BOOK_POOL.length],
                borrowDate: borrowDate,
                dueDate: due,
                returnDate: returnDate,
                date: returnDate,
                condition: REPORT_CONDITION_POOL[returnSequence % REPORT_CONDITION_POOL.length],
                penalty: lateDays * REPORT_PENALTY_PER_DAY
            });
            returnSequence += 1;
        }
    });
    return records;
}

function getLiveReturnEntries() {
    const entries = [];
    if (typeof returnRecords === 'undefined' || !Array.isArray(returnRecords)) return entries;
    returnRecords.forEach((record) => {
        const borrowed = parseReportStoredDate(record.borrowDate);
        const due = parseReportStoredDate(record.dueDate);
        const returned = parseReportStoredDate(record.returnedDate);
        if (!returned) return;
        entries.push({
            type: 'return',
            id: record.returnId,
            borrower: record.borrower,
            bookTitle: record.bookTitle,
            borrowDate: borrowed,
            dueDate: due,
            returnDate: returned,
            date: returned,
            condition: record.condition || 'Good',
            penalty: getReportLateDays(due, returned) * REPORT_PENALTY_PER_DAY,
            live: true
        });
    });
    return entries;
}

function getLiveBorrowEntries() {
    const entries = [];
    const rows = document.querySelectorAll('#borrowing .borrowing-table tbody tr');
    rows.forEach((row) => {
        const id = (row.children[0] ? row.children[0].textContent : '').trim();
        const borrowDate = parseReportStoredDate(row.children[3] ? row.children[3].textContent : '');
        if (!id || !borrowDate) return;
        const borrowerEl = row.querySelector('.borrower-name');
        const borrower = borrowerEl ? borrowerEl.textContent.trim() : (row.children[1]?.textContent?.trim() || '');
        const titleEl = row.querySelector('.book-title');
        const bookTitle = titleEl ? titleEl.textContent.trim() : (row.children[2]?.textContent?.trim() || '');
        const dueDate = parseReportStoredDate(row.children[4] ? row.children[4].textContent : '');
        const returnDate = parseReportStoredDate(row.children[5] ? row.children[5].textContent : '');
        entries.push({
            type: 'borrow',
            id: id,
            borrower: borrower,
            bookTitle: bookTitle,
            borrowDate: borrowDate,
            dueDate: dueDate,
            returnDate: returnDate,
            date: borrowDate,
            penalty: 0,
            live: true
        });
    });
    return entries;
}

function getReportRecords() {
    if (!reportSeedRecords) reportSeedRecords = buildReportSeedRecords();
    return reportSeedRecords.concat(getLiveReturnEntries(), getLiveBorrowEntries());
}

function getReportDayRecords() {
    const selected = reportState.date instanceof Date ? reportState.date : getReportToday();
    return getReportRecords().filter((record) => isSameReportDay(record.date, selected));
}

function getReportVisibleRecords() {
    const dayRecords = getReportDayRecords();
    const type = reportState.type || 'all';
    const filtered = type === 'all' ? dayRecords : dayRecords.filter((record) => record.type === type);
    return filtered.slice().sort((first, second) => {
        if (first.type !== second.type) return first.type === 'borrow' ? -1 : 1;
        return String(second.id).localeCompare(String(first.id));
    });
}

function getReportReturnStatus(record) {
    const condition = String(record.condition || '').toLowerCase();
    const damaged = condition.includes('torn') || condition.includes('damaged') || condition.includes('lost');
    return {
        label: damaged ? 'Damaged' : 'Completed',
        className: damaged ? 'return-status-pill damaged' : 'return-status-pill completed'
    };
}

function getReportBorrowStatus(record) {
    if (record.returnDate) return { label: 'Returned', className: 'status-pill returned' };
    const daysLeft = Math.round((record.dueDate.getTime() - getReportToday().getTime()) / 86400000);
    if (daysLeft < 0) return { label: 'Overdue', className: 'status-pill overdue' };
    if (daysLeft <= 2) return { label: 'Due soon', className: 'status-pill due-soon' };
    return { label: 'Borrowed', className: 'status-pill borrowed' };
}

function updateReportStats(dayRecords) {
    const borrowed = dayRecords.filter((r) => r.type === 'borrow').length;
    const returned = dayRecords.filter((r) => r.type === 'return').length;
    const totalPenalty = dayRecords.reduce((sum, r) => sum + (r.penalty || 0), 0);

    const borrowedEl = document.getElementById('reportBorrowedCount');
    const returnedEl = document.getElementById('reportReturnedCount');
    const penaltyEl = document.getElementById('reportPenaltyTotal');

    if (borrowedEl) borrowedEl.textContent = String(borrowed);
    if (returnedEl) returnedEl.textContent = String(returned);
    if (penaltyEl) penaltyEl.textContent = formatReportPeso(totalPenalty);
}

function updateReportHeader(dayRecords, visible) {
    const selected = reportState.date instanceof Date ? reportState.date : getReportToday();
    const listDateEl = document.getElementById('reportListDate');
    const listCountEl = document.getElementById('reportListCount');
    const summaryEl = document.getElementById('reportFooterSummary');
    const printDateEl = document.getElementById('reportPrintDate');

    const borrowed = dayRecords.filter((r) => r.type === 'borrow').length;
    const returned = dayRecords.filter((r) => r.type === 'return').length;
    const totalPenalty = dayRecords.reduce((sum, r) => sum + (r.penalty || 0), 0);

    if (listDateEl) listDateEl.textContent = formatReportDateLabel(selected);
    if (listCountEl) listCountEl.textContent = visible.length + (visible.length === 1 ? ' transaction' : ' transactions');
    if (summaryEl) {
        summaryEl.textContent = 'Showing ' + visible.length + ' of ' + dayRecords.length +
            ' transactions on ' + formatReportDate(selected) + '  •  ' +
            borrowed + ' borrowed, ' + returned + ' returned';
    }
    if (printDateEl) {
        printDateEl.textContent = formatReportDateWithWeekday(selected) +
            '  |  Borrowed: ' + borrowed + '  |  Returned: ' + returned +
            '  |  Total Penalties: ' + formatReportPeso(totalPenalty);
    }
}

function renderReportTable() {
    const tbody = document.getElementById('reportTableBody');
    if (!tbody) return;
    const dayRecords = getReportDayRecords();
    const visible = getReportVisibleRecords();

    tbody.innerHTML = visible.map((record) => {
        const status = record.type === 'return' ? getReportReturnStatus(record) : getReportBorrowStatus(record);
        const typePill = record.type === 'borrow'
            ? '<span class="report-type-pill borrow"><i data-lucide="book-copy"></i>Borrow</span>'
            : '<span class="report-type-pill return"><i data-lucide="rotate-ccw"></i>Return</span>';
        const penaltyCell = record.type === 'return' && record.penalty > 0
            ? '<span class="report-penalty due">' + formatReportPeso(record.penalty) + '</span>'
            : '<span class="report-muted">—</span>';
        const returnDateCell = record.returnDate ? formatReportDate(record.returnDate) : '<span class="report-muted">—</span>';

        return `
            <tr>
                <td>${typePill}</td>
                <td><span class="report-id">${record.id}</span></td>
                <td>${record.borrower}</td>
                <td class="report-book-cell" title="${record.bookTitle}">${record.bookTitle}</td>
                <td>${formatReportDate(record.borrowDate)}</td>
                <td>${formatReportDate(record.dueDate)}</td>
                <td>${returnDateCell}</td>
                <td>${penaltyCell}</td>
                <td><span class="${status.className}">${status.label}</span></td>
            </tr>
        `;
    }).join('');

    const emptyEl = document.getElementById('reportEmptyState');
    if (emptyEl) emptyEl.classList.toggle('hidden', visible.length > 0);

    updateReportStats(dayRecords);
    updateReportHeader(dayRecords, visible);
    if (window.lucide) lucide.createIcons();
}

function syncReportDateInput() {
    const input = document.getElementById('reportDateFilter');
    if (input) input.value = toReportInputValue(reportState.date || getReportToday());
}

function applyReportDate() {
    const input = document.getElementById('reportDateFilter');
    if (!input || !input.value) return;
    const parsed = new Date(input.value + 'T00:00:00');
    if (isNaN(parsed.getTime())) return;
    reportState.date = parsed;
    renderReportTable();
}

function shiftReportDate(offsetDays) {
    reportState.date = shiftReportDay(offsetDays);
    syncReportDateInput();
    renderReportTable();
}

function goToTodayReport() {
    reportState.date = getReportToday();
    syncReportDateInput();
    renderReportTable();
}

function setReportType(type, button) {
    reportState.type = type;
    const group = document.getElementById('reportTypeFilters');
    if (group) {
        group.querySelectorAll('.report-seg').forEach((seg) => {
            seg.classList.toggle('active', seg === button || seg.dataset.type === type);
        });
    }
    renderReportTable();
}

function printReport() {
    refreshReports();
    window.print();
}

function refreshReports() {
    if (!(reportState.date instanceof Date)) reportState.date = getReportToday();
    syncReportDateInput();
    const group = document.getElementById('reportTypeFilters');
    if (group) {
        group.querySelectorAll('.report-seg').forEach((seg) => {
            seg.classList.toggle('active', seg.dataset.type === reportState.type);
        });
    }
    renderReportTable();
}

/* Backwards compatible helpers */
function renderReportsCharts() { refreshReports(); }
function exportReport() { printReport(); }
