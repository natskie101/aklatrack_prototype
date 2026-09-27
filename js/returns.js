/* Return Book module - scan/lookup a borrow record, complete the return and
   keep both the Recent Return Records table and the Borrowing module in sync. */

const RETURN_CONDITIONS = ['Good (No damage)', 'Minor Wear', 'Torn Cover', 'Damaged Spine', 'Lost Pages'];
const RETURN_DAMAGE_CONDITIONS = ['Torn Cover', 'Damaged Spine', 'Lost Pages'];
const RETURN_MONTHS = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};

let returnPendingRecords = null;
let returnRecords = null;
let returnCounters = null;

function getReturnDateOnly(offsetDays){
    const date = new Date();
    date.setHours(0,0,0,0);
    if(typeof offsetDays === 'number') date.setDate(date.getDate() + offsetDays);
    return date;
}

function isSameReturnDay(first, second){
    if(!(first instanceof Date) || !(second instanceof Date)) return false;
    return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

function parseReturnStoredDate(value){
    if(value instanceof Date) return value;
    if(!value) return null;
    const cleaned = String(value).replace(/\(today\)/i,'').replace(/,/g,' ').trim();
    if(!cleaned || cleaned === '—') return null;
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if(parts.length >= 3){
        const month = RETURN_MONTHS[parts[0]];
        const day = Number(parts[1]);
        const year = Number(parts[2]);
        if(typeof month === 'number' && !Number.isNaN(day) && !Number.isNaN(year)){
            return new Date(year, month, day);
        }
    }
    const fallback = new Date(cleaned);
    return isNaN(fallback.getTime()) ? null : fallback;
}

function formatReturnShortDate(value){
    const date = parseReturnStoredDate(value);
    if(!date) return '—';
    return date.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}

function formatReturnFullDate(value){
    const date = parseReturnStoredDate(value);
    if(!date) return '—';
    return date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

/* "Sep 17" inside the records table, "Sep 17 (Today)" when the date is today */
function formatReturnTableDate(value){
    const date = parseReturnStoredDate(value);
    if(!date) return '—';
    const label = formatReturnShortDate(date);
    return isSameReturnDay(date, getReturnDateOnly()) ? `${label} (Today)` : label;
}

/* "Sep 17, 2026" inside the scanned details panel */
function formatReturnPanelDate(value){
    const date = parseReturnStoredDate(value);
    if(!date) return '—';
    const label = formatReturnFullDate(date);
    return isSameReturnDay(date, getReturnDateOnly()) ? `${label} (Today)` : label;
}

/* Pending borrows that can still be returned - dates are relative to today so
   the "(Today)" markers stay accurate. */
function getReturnPendingSeed(){
    return [
        {borrowId:'TX-9402', accession:'4215325', borrower:'Ana Reyes', borrowerId:'113431', bookTitle:'Database Systems', borrowDate:getReturnDateOnly(-7), dueDate:getReturnDateOnly(0)},
        {borrowId:'TX-9401', accession:'312342', borrower:'Mark Santos', borrowerId:'114564', bookTitle:'Web Development with Node & Express', borrowDate:getReturnDateOnly(-7), dueDate:getReturnDateOnly(-2)},
        {borrowId:'TX-9398', accession:'418877', borrower:'Jessa Lim', borrowerId:'114563', bookTitle:'Networking Basics 101', borrowDate:getReturnDateOnly(-8), dueDate:getReturnDateOnly(-1)},
        {borrowId:'TX-9395', accession:'402215', borrower:'Paul Cruz', borrowerId:'115632', bookTitle:'Information Security Principles', borrowDate:getReturnDateOnly(-12), dueDate:getReturnDateOnly(-5)},
        {borrowId:'TX-9394', accession:'398721', borrower:'Mika Flores', borrowerId:'114356', bookTitle:'Programming in C#', borrowDate:getReturnDateOnly(-11), dueDate:getReturnDateOnly(-4)},
        {borrowId:'TX-9390', accession:'377654', borrower:'Erin Rainer', borrowerId:'114345', bookTitle:'Introduction to Algorithms', borrowDate:getReturnDateOnly(-2), dueDate:getReturnDateOnly(12)}
    ];
}

function getReturnRecordsSeed(){
    return [
        {returnId:'RET-9402', borrower:'Ana Reyes', bookTitle:'Database Systems Handbook', borrowDate:getReturnDateOnly(-7), dueDate:getReturnDateOnly(0), returnedDate:getReturnDateOnly(0), condition:'Good'},
        {returnId:'RET-9401', borrower:'Mark Santos', bookTitle:'Web Development', borrowDate:getReturnDateOnly(-7), dueDate:getReturnDateOnly(-2), returnedDate:getReturnDateOnly(0), condition:'Good'},
        {returnId:'RET-9398', borrower:'Jessa Lim', bookTitle:'Networking Basics 101', borrowDate:getReturnDateOnly(-8), dueDate:getReturnDateOnly(-1), returnedDate:getReturnDateOnly(-1), condition:'Torn Cover'},
        {returnId:'RET-9395', borrower:'Paul Cruz', bookTitle:'Information Security Principles', borrowDate:getReturnDateOnly(-12), dueDate:getReturnDateOnly(-5), returnedDate:getReturnDateOnly(-2), condition:'Good'}
    ];
}

function initReturnsModule(){
    if(returnPendingRecords && returnRecords && returnCounters) return;
    returnPendingRecords = getReturnPendingSeed();
    returnRecords = getReturnRecordsSeed();
    const todayCount = document.getElementById('returnsTodayCount');
    const pendingCount = document.getElementById('returnsPendingCount');
    const overdueCount = document.getElementById('returnsOverdueCount');
    returnCounters = {
        today: Number(todayCount?.textContent) || 0,
        pending: Number(pendingCount?.textContent) || 0,
        overdue: Number(overdueCount?.textContent) || 0
    };
}

function getReturnConditionLabel(condition){
    const value = String(condition || '').trim();
    if(!value) return 'Good';
    return value.toLowerCase().indexOf('good') === 0 ? 'Good' : value;
}

function getReturnStatusLabel(condition){
    return RETURN_DAMAGE_CONDITIONS.includes(getReturnConditionLabel(condition)) ? 'Damaged' : 'Completed';
}

function findReturnPendingRecord(scanValue){
    const query = String(scanValue || '').trim().toLowerCase();
    if(!query) return null;
    return returnPendingRecords.find((record) =>
        record.borrowId.toLowerCase() === query ||
        String(record.accession || '').toLowerCase() === query ||
        record.bookTitle.toLowerCase() === query
    ) || null;
}

function findProcessedReturnRecord(scanValue){
    const query = String(scanValue || '').trim().toLowerCase();
    if(!query) return null;
    return returnRecords.find((record) => String(record.borrowId || '').toLowerCase() === query) || null;
}

function setReturnBadge(text, state){
    const badge = document.getElementById('scannedStatusBadge');
    if(!badge) return;
    badge.textContent = text;
    badge.className = 'scanned-badge badge-' + state;
}

function renderReturnScanPanel(record, scanValue){
    const borrowerField = document.getElementById('returnBorrowerName');
    const titleEl = document.getElementById('scannedBookTitle');
    const borrowerEl = document.getElementById('scannedBorrower');
    const borrowDateEl = document.getElementById('scannedBorrowDate');
    const dueDateEl = document.getElementById('scannedDueDate');
    const hasValue = Boolean(String(scanValue || '').trim());

    if(record){
        if(titleEl) titleEl.textContent = record.bookTitle;
        if(borrowerEl) borrowerEl.textContent = `${record.borrower} (Student ID ${record.borrowerId})`;
        if(borrowDateEl) borrowDateEl.textContent = formatReturnPanelDate(record.borrowDate);
        if(dueDateEl) dueDateEl.textContent = formatReturnPanelDate(record.dueDate);
        if(borrowerField) borrowerField.value = record.borrower;
        setReturnBadge('Validated','valid');
        return;
    }

    if(titleEl) titleEl.textContent = '—';
    if(borrowerEl) borrowerEl.textContent = '—';
    if(borrowDateEl) borrowDateEl.textContent = '—';
    if(dueDateEl) dueDateEl.textContent = '—';
    if(borrowerField) borrowerField.value = '';
    setReturnBadge(hasValue ? 'Not found' : 'Awaiting scan', hasValue ? 'invalid' : 'idle');
}

function handleReturnLookup(){
    initReturnsModule();
    const scanInput = document.getElementById('returnTransaction');
    const scanValue = scanInput ? scanInput.value : '';
    renderReturnScanPanel(findReturnPendingRecord(scanValue), scanValue);
}

function showReturnFormMessage(text, state){
    const messageEl = document.getElementById('returnFormMessage');
    if(!messageEl) return;
    messageEl.textContent = text || '';
    messageEl.classList.remove('is-success','is-error');
    if(state === 'success') messageEl.classList.add('is-success');
    if(state === 'error') messageEl.classList.add('is-error');
}

function updateReturnCounters(returnedRecord){
    if(!returnCounters) return;
    returnCounters.today += 1;
    returnCounters.pending = Math.max(0, returnCounters.pending - 1);
    const dueDate = parseReturnStoredDate(returnedRecord ? returnedRecord.dueDate : null);
    if(dueDate && dueDate.getTime() < getReturnDateOnly().getTime()){
        returnCounters.overdue = Math.max(0, returnCounters.overdue - 1);
    }
    const todayEl = document.getElementById('returnsTodayCount');
    const pendingEl = document.getElementById('returnsPendingCount');
    const overdueEl = document.getElementById('returnsOverdueCount');
    if(todayEl) todayEl.textContent = String(returnCounters.today);
    if(pendingEl) pendingEl.textContent = String(returnCounters.pending);
    if(overdueEl) overdueEl.textContent = String(returnCounters.overdue);
}

function getNextReturnId(){
    const used = returnRecords
        .map((record) => Number(String(record.returnId).replace(/[^0-9]/g,'')))
        .filter((value) => !Number.isNaN(value));
    const next = used.length ? Math.max.apply(null, used) + 1 : 9403;
    return `RET-${next}`;
}

function renderReturnRecords(){
    const tbody = document.getElementById('returnRecordsBody');
    if(!tbody) return;
    tbody.innerHTML = returnRecords.map((record) => {
        const condition = getReturnConditionLabel(record.condition);
        const status = getReturnStatusLabel(condition);
        const statusClass = status === 'Damaged' ? 'damaged' : 'completed';
        const returnedToday = isSameReturnDay(parseReturnStoredDate(record.returnedDate), getReturnDateOnly());
        return `
            <tr data-condition="${condition}">
                <td><span class="return-id">${record.returnId}</span></td>
                <td>${record.borrower}</td>
                <td>${record.bookTitle}</td>
                <td>${formatReturnShortDate(record.borrowDate)}</td>
                <td>${formatReturnShortDate(record.dueDate)}</td>
                <td class="${returnedToday ? 'return-date-today' : ''}">${formatReturnTableDate(record.returnedDate)}</td>
                <td><span class="return-condition-cell">${condition}</span></td>
                <td><span class="return-status-pill ${statusClass}">${status}</span></td>
            </tr>
        `;
    }).join('');
}

function filterReturnRecords(){
    const tbody = document.getElementById('returnRecordsBody');
    if(!tbody) return 0;
    const filterEl = document.getElementById('returnConditionFilter');
    const selected = filterEl ? filterEl.value : 'all';
    let visibleCount = 0;

    tbody.querySelectorAll('tr').forEach((row) => {
        const matches = selected === 'all' || row.dataset.condition === selected;
        row.classList.toggle('hidden', !matches);
        if(matches) visibleCount += 1;
    });

    const emptyEl = document.getElementById('returnRecordsEmpty');
    if(emptyEl) emptyEl.classList.toggle('hidden', visibleCount > 0);
    return visibleCount;
}

/* Keep the Borrowing Management table consistent with the processed return. */
function markBorrowingRowReturned(processedRecord){
    if(!processedRecord || !processedRecord.borrowId) return;
    const rows = document.querySelectorAll('#borrowing .borrowing-table tbody tr');
    rows.forEach((row) => {
        const borrowId = (row.children[0] ? row.children[0].textContent : '').trim();
        if(borrowId.toLowerCase() !== processedRecord.borrowId.toLowerCase()) return;
        const returnDateCell = row.children[5];
        if(returnDateCell) returnDateCell.textContent = formatReturnPanelDate(processedRecord.returnedDate);
        const statusPill = row.querySelector('.status-pill');
        if(statusPill){
            statusPill.className = 'status-pill returned';
            statusPill.textContent = 'Returned';
        }
    });
    if(typeof filterBorrowingRows === 'function') filterBorrowingRows();
}

function processReturnSubmit(event){
    if(event) event.preventDefault();
    initReturnsModule();

    const scanInput = document.getElementById('returnTransaction');
    const scanValue = scanInput ? scanInput.value.trim() : '';
    if(!scanValue){
        renderReturnScanPanel(null, '');
        showReturnFormMessage('Scan or enter a Borrow ID / ISBN before completing the return.','error');
        return;
    }

    const pendingRecord = findReturnPendingRecord(scanValue);
    if(!pendingRecord){
        const processedRecord = findProcessedReturnRecord(scanValue);
        renderReturnScanPanel(null, scanValue);
        showReturnFormMessage(
            processedRecord
                ? `Return ${processedRecord.returnId} for ${scanValue.toUpperCase()} was already processed.`
                : `No pending borrow record found for "${scanValue}".`,
            'error'
        );
        return;
    }

    const conditionSelect = document.getElementById('returnCondition');
    const condition = getReturnConditionLabel(conditionSelect ? conditionSelect.value : '');
    const processedRecord = {
        borrowId: pendingRecord.borrowId,
        returnId: getNextReturnId(),
        borrower: pendingRecord.borrower,
        bookTitle: pendingRecord.bookTitle,
        borrowDate: pendingRecord.borrowDate,
        dueDate: pendingRecord.dueDate,
        returnedDate: getReturnDateOnly(),
        condition: condition
    };

    returnRecords.unshift(processedRecord);
    returnPendingRecords = returnPendingRecords.filter((record) => record !== pendingRecord);

    updateReturnCounters(processedRecord);
    if(scanInput) scanInput.value = '';
    if(conditionSelect) conditionSelect.value = RETURN_CONDITIONS[0];
    const filterEl = document.getElementById('returnConditionFilter');
    if(filterEl) filterEl.value = 'all';

    renderReturnScanPanel(null, '');
    renderReturnRecords();
    filterReturnRecords();
    markBorrowingRowReturned(processedRecord);
    showReturnFormMessage(
        `Return ${processedRecord.returnId} completed for ${processedRecord.borrower} - ${getReturnStatusLabel(condition)}.`,
        'success'
    );
    if(window.lucide) lucide.createIcons();
}

function refreshReturns(){
    initReturnsModule();
    renderReturnRecords();
    filterReturnRecords();
    const scanInput = document.getElementById('returnTransaction');
    if(scanInput) scanInput.value = '';
    renderReturnScanPanel(null, '');
    showReturnFormMessage('');
    if(window.lucide) lucide.createIcons();
}
