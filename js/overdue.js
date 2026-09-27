/* Overdue Monitoring module - overdue listing with automatic penalties
   (PHP 10 per overdue day), notice tracking, filters and bulk reminders. */

const OVERDUE_PENALTY_PER_DAY = 10;
const OVERDUE_PAGE_SIZE = 9;

let overdueRecords = null;
const overdueState = {bucket:'all', search:'', notice:'all', page:1};

function getOverdueToday(){
    const date = new Date();
    date.setHours(0,0,0,0);
    return date;
}

function shiftOverdueDate(offsetDays){
    const date = getOverdueToday();
    date.setDate(date.getDate() + offsetDays);
    return date;
}

function formatOverdueDate(value){
    if(!(value instanceof Date) || isNaN(value.getTime())) return '—';
    return value.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

/* Days overdue and the penalty are always derived from the due date
   (today - due date), so both stay correct however long the page stays open. */
function getOverdueDays(record){
    if(!record || !(record.dueDate instanceof Date)) return 0;
    const diff = Math.round((getOverdueToday().getTime() - record.dueDate.getTime()) / 86400000);
    return Math.max(diff, 0);
}

function getOverduePenalty(days){
    return Math.max(days, 0) * OVERDUE_PENALTY_PER_DAY;
}

function formatOverduePeso(amount){
    return '\u20B1' + amount.toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2});
}

/* The nine records on the first page match the design; the rest of the set is
   generated below. Days overdue are relative to today and the borrow date is
   always 14 days before the due date. */
function getOverdueFeaturedSeed(){
    return [
        {borrowId:'TX-9041', borrower:'Ana Reyes', bookTitle:'Database Systems: Complete Guide', daysOverdue:32, noticeStatus:'Escalated'},
        {borrowId:'TX-8984', borrower:'Mark Santos', bookTitle:'Modern Web Development', daysOverdue:27, noticeStatus:'Notice Sent'},
        {borrowId:'TX-9120', borrower:'Jessa Lim', bookTitle:'Computer Networking Basics', daysOverdue:22, noticeStatus:'Notice Sent'},
        {borrowId:'TX-9302', borrower:'Paul Cruz', bookTitle:'Information Security Essentials', daysOverdue:10, noticeStatus:'Pending'},
        {borrowId:'TX-9422', borrower:'Mika Flores', bookTitle:'Introduction to OOP Programming', daysOverdue:6, noticeStatus:'Pending'},
        {borrowId:'TX-8711', borrower:'David Kim', bookTitle:'Artificial Intelligence: A Modern Approach', daysOverdue:61, noticeStatus:'Escalated'},
        {borrowId:'TX-9511', borrower:'Elena Rostova', bookTitle:'Abstract Algebra & Applications', daysOverdue:1, noticeStatus:'Pending'},
        {borrowId:'TX-9092', borrower:'Carlos Vance', bookTitle:'Organic Chemistry 101', daysOverdue:14, noticeStatus:'Notice Sent'},
        {borrowId:'TX-9114', borrower:'Clara Oswald', bookTitle:'Fundamentals of Quantum Mechanics', daysOverdue:9, noticeStatus:'Resolved'}
    ];
}

const OVERDUE_EXTRA_BORROWERS = ['Erin Rainer','Elena Petrova','Robert Chen','Maria Santos','Nina Alvarez','Paolo Reyes','Grace Uy','Hector Diaz','Liza Mercado','Sam Tan','Rosa Bautista','Victor Lim','Dana Cruz','Omar Santos','Kyle Yap','Bea Fernandez','Noel Rivera','Tricia Gomez','Aldrin Reyes','Mia Tan'];
const OVERDUE_EXTRA_BOOKS = ['Data Structures & Algorithms in Java','Operating System Concepts','Clean Code','Introduction to Database Management','Software Engineering: A Practitioner Approach','Discrete Mathematics and Its Applications','Fundamentals of Physics','Philippine Constitutional Law','Principles of Economics','Calculus: Early Transcendentals','Statistical Methods for Research','Business Ethics and Social Responsibility','Hospitality Management Essentials','Tourism Planning and Development','Criminal Justice Today','Management Accounting Principles','Anatomy and Physiology','Nursing Informatics','Web Programming with PHP & MySQL','Mobile Application Development','Human Resource Management','Financial Accounting Fundamentals','Obligations and Contracts Law','Agricultural Economics','Environmental Science Today'];
/* 39 extra records: 10 of them critical (more than 30 days overdue) so the module
   totals read 48 overdue books / 12 critical, matching the design. The day counts
   are spread so the recipient groups in the dispatch modal read 1-7 days (22),
   8-30 days (14) and 30+ days critical (12). */
const OVERDUE_EXTRA_DAYS = [45,7,6,38,5,4,41,30,2,1,29,7,6,5,28,4,30,2,1,26,7,52,6,33,5,24,4,36,21,2,58,66,7,42,25,18,5,55,4];
/* Exactly 5 generated records are still waiting for a notice, which keeps the
   "Pending Notices" card at 8 (3 of the featured rows are pending too). */
const OVERDUE_EXTRA_NOTICES = ['Escalated','Notice Sent','Notice Sent','Resolved','Notice Sent','Pending','Pending','Notice Sent','Resolved','Notice Sent','Resolved','Notice Sent','Pending','Notice Sent','Resolved','Notice Sent','Resolved','Notice Sent','Pending','Notice Sent','Resolved','Escalated','Notice Sent','Escalated','Notice Sent','Resolved','Notice Sent','Resolved','Notice Sent','Resolved','Notice Sent','Resolved','Escalated','Notice Sent','Escalated','Notice Sent','Escalated','Notice Sent','Pending'];

function buildOverdueRecord(borrowId, borrower, bookTitle, daysOverdue, noticeStatus){
    return {
        borrowId: borrowId,
        borrower: borrower,
        bookTitle: bookTitle,
        borrowDate: shiftOverdueDate(-daysOverdue - 14),
        dueDate: shiftOverdueDate(-daysOverdue),
        noticeStatus: noticeStatus
    };
}

function ensureOverdueData(){
    if(overdueRecords) return overdueRecords;
    const featured = getOverdueFeaturedSeed().map((row) =>
        buildOverdueRecord(row.borrowId, row.borrower, row.bookTitle, row.daysOverdue, row.noticeStatus)
    );
    const generated = OVERDUE_EXTRA_DAYS.map((days, index) =>
        buildOverdueRecord(
            'TX-' + (8600 - index * 17),
            OVERDUE_EXTRA_BORROWERS[index % OVERDUE_EXTRA_BORROWERS.length],
            OVERDUE_EXTRA_BOOKS[index % OVERDUE_EXTRA_BOOKS.length],
            days,
            OVERDUE_EXTRA_NOTICES[index] || 'Notice Sent'
        )
    );
    overdueRecords = featured.concat(generated);
    return overdueRecords;
}

function matchesOverdueBucket(days, bucket){
    if(bucket === '1-7') return days >= 1 && days <= 7;
    if(bucket === '8-30') return days >= 8 && days <= 30;
    if(bucket === '30+') return days > 30;
    return true;
}

function getFilteredOverdueRecords(){
    const search = String(overdueState.search || '').trim().toLowerCase();
    const notice = overdueState.notice || 'all';
    return ensureOverdueData().filter((record) => {
        if(!matchesOverdueBucket(getOverdueDays(record), overdueState.bucket)) return false;
        if(notice !== 'all' && record.noticeStatus !== notice) return false;
        if(search){
            const haystack = (record.borrowId + ' ' + record.borrower + ' ' + record.bookTitle).toLowerCase();
            if(haystack.indexOf(search) === -1) return false;
        }
        return true;
    });
}

function getOverdueNoticeClass(status){
    const value = String(status || '').toLowerCase();
    if(value === 'escalated') return 'escalated';
    if(value === 'notice sent') return 'notice-sent';
    if(value === 'resolved') return 'resolved';
    return 'pending';
}

function getOverdueNoticeIcon(status){
    const value = String(status || '').toLowerCase();
    if(value === 'escalated') return 'zap';
    if(value === 'notice sent') return 'mail-check';
    if(value === 'resolved') return 'circle-check';
    return 'clock';
}

function updateOverdueStats(){
    const records = ensureOverdueData();
    const critical = records.filter((record) => getOverdueDays(record) > 30).length;
    const pending = records.filter((record) => record.noticeStatus === 'Pending').length;
    const totalEl = document.getElementById('overdueTotalCount');
    const criticalEl = document.getElementById('overdueCriticalCount');
    const pendingEl = document.getElementById('overduePendingNoticeCount');
    if(totalEl) totalEl.textContent = String(records.length);
    if(criticalEl) criticalEl.textContent = String(critical);
    if(pendingEl) pendingEl.textContent = String(pending);
}

function updateOverdueFooter(filtered, start, shown){
    const summary = document.getElementById('overdueFooterSummary');
    if(!summary) return;
    if(!filtered.length){
        summary.textContent = 'Showing 0 of 0 overdue records';
        return;
    }
    const totalPenalty = ensureOverdueData().reduce((sum, record) => sum + getOverduePenalty(getOverdueDays(record)), 0);
    summary.textContent = 'Showing ' + (start + 1) + ' - ' + (start + shown) + ' of ' + filtered.length + ' overdue records  •  Total penalties: ' + formatOverduePeso(totalPenalty);
}

function renderOverduePagination(totalPages){
    const container = document.getElementById('overduePagination');
    if(!container) return;
    const current = overdueState.page;
    const parts = [];
    parts.push('<button type="button" class="overdue-page-btn" ' + (current === 1 ? 'disabled' : '') + ' onclick="goToOverduePage(' + (current - 1) + ')">Previous</button>');
    for(let page = 1; page <= totalPages; page += 1){
        const visible = page === 1 || page === totalPages || Math.abs(page - current) <= 2;
        if(visible){
            parts.push('<button type="button" class="overdue-page-btn ' + (page === current ? 'active' : '') + '" onclick="goToOverduePage(' + page + ')">' + page + '</button>');
        } else if(page === 2 || page === totalPages - 1){
            parts.push('<span class="overdue-page-ellipsis">…</span>');
        }
    }
    parts.push('<button type="button" class="overdue-page-btn" ' + (current === totalPages ? 'disabled' : '') + ' onclick="goToOverduePage(' + (current + 1) + ')">Next</button>');
    container.innerHTML = parts.join('');
}

function renderOverdueTable(){
    const tbody = document.getElementById('overdueTableBody');
    if(!tbody) return;
    const filtered = getFilteredOverdueRecords();
    const totalPages = Math.max(1, Math.ceil(filtered.length / OVERDUE_PAGE_SIZE));
    if(overdueState.page > totalPages) overdueState.page = totalPages;
    const start = (overdueState.page - 1) * OVERDUE_PAGE_SIZE;
    const pageRecords = filtered.slice(start, start + OVERDUE_PAGE_SIZE);

    tbody.innerHTML = pageRecords.map((record) => {
        const days = getOverdueDays(record);
        const criticalTag = days > 30 ? '<span class="overdue-critical-tag">CRITICAL</span>' : '';
        const noticeClass = getOverdueNoticeClass(record.noticeStatus);
        return `
            <tr>
                <td><span class="overdue-id">${record.borrowId}</span></td>
                <td>${record.borrower}</td>
                <td class="overdue-book-cell" title="${record.bookTitle}">${record.bookTitle}</td>
                <td>${formatOverdueDate(record.borrowDate)}</td>
                <td>${formatOverdueDate(record.dueDate)}</td>
                <td><span class="overdue-days-cell"><span class="overdue-days">${days} ${days === 1 ? 'day' : 'days'}</span>${criticalTag}</span></td>
                <td class="overdue-penalty">${formatOverduePeso(getOverduePenalty(days))}</td>
                <td><span class="overdue-notice-pill ${noticeClass}"><i data-lucide="${getOverdueNoticeIcon(record.noticeStatus)}"></i>${record.noticeStatus}</span></td>
            </tr>
        `;
    }).join('');

    if(!pageRecords.length){
        tbody.innerHTML = '<tr><td colspan="8" class="overdue-empty">No overdue records match the current filters.</td></tr>';
    }

    updateOverdueFooter(filtered, start, pageRecords.length);
    renderOverduePagination(totalPages);
    updateOverdueStats();
    if(window.lucide) lucide.createIcons();
}

function goToOverduePage(page){
    const filtered = getFilteredOverdueRecords();
    const totalPages = Math.max(1, Math.ceil(filtered.length / OVERDUE_PAGE_SIZE));
    overdueState.page = Math.min(Math.max(page, 1), totalPages);
    renderOverdueTable();
}

function setOverdueBucket(bucket, button){
    overdueState.bucket = bucket;
    overdueState.page = 1;
    const group = document.getElementById('overdueBucketFilters');
    if(group){
        group.querySelectorAll('.overdue-seg').forEach((seg) => {
            seg.classList.toggle('active', seg === button || seg.dataset.bucket === bucket);
        });
    }
    renderOverdueTable();
}

function applyOverdueFilters(){
    const searchInput = document.getElementById('overdueSearchInput');
    const noticeSelect = document.getElementById('overdueNoticeFilter');
    overdueState.search = searchInput ? searchInput.value : '';
    overdueState.notice = noticeSelect ? noticeSelect.value : 'all';
    overdueState.page = 1;
    renderOverdueTable();
}

function resetOverdueFilters(){
    const searchInput = document.getElementById('overdueSearchInput');
    const noticeSelect = document.getElementById('overdueNoticeFilter');
    if(searchInput) searchInput.value = '';
    if(noticeSelect) noticeSelect.value = 'all';
    overdueState.search = '';
    overdueState.notice = 'all';
    overdueState.page = 1;
    renderOverdueTable();
    showOverdueMessage('Search and notice filters cleared.');
}

function toggleOverdueMoreFilters(){
    const panel = document.getElementById('overdueMoreFilters');
    if(!panel) return;
    panel.classList.toggle('hidden');
    if(window.lucide) lucide.createIcons();
}

function showOverdueMessage(text, state){
    const messageEl = document.getElementById('overdueNoticeMessage');
    if(!messageEl) return;
    messageEl.textContent = text || '';
    messageEl.classList.remove('is-success','is-error');
    if(state === 'success') messageEl.classList.add('is-success');
    if(state === 'error') messageEl.classList.add('is-error');
}

/* Reminder templates available in the bulk dispatch modal. [Placeholders] are
   filled in per borrower when the reminders are dispatched. */
const BULK_REMINDER_TEMPLATES = {
    standard: {
        subject: 'Library Notice: Overdue Book Return Reminder',
        body: 'Dear [Borrower_Name],\nThis is a reminder that "[Book_Title]" was due on [Due_Date]. Please return it to the library or contact the librarian at [Librarian_Phone].\nThank you,\n[School_Name] College of Technology library office.',
        sms: 'LIBRARY NOTICE: Dear [Borrower_Name], "[Book_Title]" was due on [Due_Date]. Kindly return it or contact [Librarian_Phone]. [School_Name] Library.'
    },
    first: {
        subject: 'Friendly Reminder: Please Return Your Borrowed Book',
        body: 'Hi [Borrower_Name],\nOur records show that "[Book_Title]" is [Days_Overdue] day(s) overdue (due on [Due_Date]). Please return it on your next library visit.\nThank you,\n[School_Name] College of Technology library office.',
        sms: 'REMINDER: Hi [Borrower_Name], "[Book_Title]" is [Days_Overdue] day(s) overdue. Please return it soon. [School_Name] Library.'
    },
    final: {
        subject: 'FINAL NOTICE: Overdue Book - PHP 10 per Day Penalty',
        body: 'Dear [Borrower_Name],\n"[Book_Title]" is [Days_Overdue] days overdue (due on [Due_Date]). A penalty of PHP 10 per day is being charged and your borrowing account may be suspended.\nPlease settle at the library office immediately.\n[School_Name] College of Technology library office.',
        sms: 'FINAL NOTICE: "[Book_Title]" is [Days_Overdue] days overdue. PHP 10/day penalty applies and your account may be suspended. [School_Name] Library.'
    }
};

function getReminderGroupValue(){
    const checked = document.querySelector('#bulkRemindersModal input[name="reminderGroup"]:checked');
    return checked ? checked.value : 'all';
}

function getReminderGroupRecords(){
    const group = getReminderGroupValue();
    return ensureOverdueData().filter((record) => {
        const days = getOverdueDays(record);
        if(group === '1-7') return days >= 1 && days <= 7;
        if(group === '30+') return days > 30;
        return true;
    });
}

function getReminderChannelNames(){
    const channels = [];
    const emailEl = document.getElementById('reminderChannelEmail');
    const smsEl = document.getElementById('reminderChannelSms');
    if(emailEl && emailEl.checked) channels.push('Email');
    if(smsEl && smsEl.checked) channels.push('SMS');
    return channels;
}

function getReminderDispatchTime(){
    const checked = document.querySelector('#bulkRemindersModal input[name="reminderDispatchTime"]:checked');
    return checked ? checked.value : 'now';
}

function showBulkRemindersError(text){
    const errorEl = document.getElementById('bulkRemindersError');
    if(!errorEl) return;
    errorEl.textContent = text || '';
    errorEl.classList.toggle('hidden', !text);
}

function updateBulkReminderPreview(){
    const select = document.getElementById('reminderTemplate');
    const template = BULK_REMINDER_TEMPLATES[select ? select.value : 'standard'] || BULK_REMINDER_TEMPLATES.standard;
    const subjectEl = document.getElementById('reminderPreviewSubject');
    const bodyEl = document.getElementById('reminderPreviewBody');
    const smsBodyEl = document.getElementById('reminderSmsPreviewBody');
    const smsCountEl = document.getElementById('reminderSmsPreviewCount');
    if(subjectEl) subjectEl.textContent = 'Subject Line: ' + template.subject;
    if(bodyEl) bodyEl.textContent = template.body;
    if(smsBodyEl) smsBodyEl.textContent = template.sms;
    if(smsCountEl) smsCountEl.textContent = template.sms.length + ' / 160 characters';
}

function updateBulkRemindersSummary(){
    const all = ensureOverdueData();
    const late = all.filter((record) => getOverdueDays(record) >= 1 && getOverdueDays(record) <= 7);
    const critical = all.filter((record) => getOverdueDays(record) > 30);
    const allEl = document.getElementById('recipientAllCount');
    const lateEl = document.getElementById('recipientLateCount');
    const criticalEl = document.getElementById('recipientCriticalCount');
    if(allEl) allEl.textContent = String(all.length);
    if(lateEl) lateEl.textContent = String(late.length);
    if(criticalEl) criticalEl.textContent = String(critical.length);

    const channels = getReminderChannelNames();
    const targets = getReminderGroupRecords();
    const scheduled = getReminderDispatchTime() === 'schedule';
    const scheduleInput = document.getElementById('reminderScheduleDate');
    if(scheduleInput){
        scheduleInput.classList.toggle('hidden', !scheduled);
        scheduleInput.disabled = !scheduled;
        if(!scheduled) scheduleInput.value = '';
    }

    const summaryEl = document.getElementById('reminderDispatchSummaryText');
    if(summaryEl){
        const parts = channels.map((channel) => targets.length + ' ' + (channel === 'Email' && targets.length !== 1 ? 'Emails' : channel));
        const messagePart = parts.length ? parts.join(' • ') : 'No channel selected';
        const borrowerWord = targets.length === 1 ? 'Borrower' : 'Borrowers';
        summaryEl.textContent = 'Total Message: ' + messagePart + ' • Target: ' + targets.length + ' ' + borrowerWord + (scheduled ? ' • Scheduled' : '');
    }

    const smsPreview = document.getElementById('reminderSmsPreview');
    if(smsPreview) smsPreview.classList.toggle('hidden', channels.indexOf('SMS') === -1);

    showBulkRemindersError('');
    updateBulkReminderPreview();
    if(window.lucide) lucide.createIcons();
}

function openBulkRemindersModal(){
    ensureOverdueData();
    const groupAll = document.querySelector('#bulkRemindersModal input[name="reminderGroup"][value="all"]');
    if(groupAll) groupAll.checked = true;
    const emailEl = document.getElementById('reminderChannelEmail');
    const smsEl = document.getElementById('reminderChannelSms');
    if(emailEl) emailEl.checked = true;
    if(smsEl) smsEl.checked = false;
    const templateSelect = document.getElementById('reminderTemplate');
    if(templateSelect) templateSelect.value = 'standard';
    const dispatchNow = document.querySelector('#bulkRemindersModal input[name="reminderDispatchTime"][value="now"]');
    if(dispatchNow) dispatchNow.checked = true;
    updateBulkRemindersSummary();
    openModal('bulkRemindersModal');
}

function sendBulkReminders(){
    const channels = getReminderChannelNames();
    if(!channels.length){
        showBulkRemindersError('Select at least one delivery channel (Email or SMS).');
        return;
    }
    const targets = getReminderGroupRecords();
    if(!targets.length){
        showBulkRemindersError('No overdue records match the selected recipient group.');
        return;
    }
    const scheduled = getReminderDispatchTime() === 'schedule';
    const scheduleInput = document.getElementById('reminderScheduleDate');
    const scheduleValue = scheduleInput ? scheduleInput.value : '';
    if(scheduled && !scheduleValue){
        showBulkRemindersError('Choose a date for the scheduled dispatch.');
        return;
    }

    if(scheduled){
        const scheduledDate = formatOverdueDate(new Date(scheduleValue + 'T00:00:00'));
        showOverdueMessage(targets.length + ' ' + (targets.length === 1 ? 'reminder' : 'reminders') + ' (' + channels.join(' + ') + ') scheduled for ' + scheduledDate + '.','success');
    } else {
        targets.filter((record) => record.noticeStatus === 'Pending').forEach((record) => { record.noticeStatus = 'Notice Sent'; });
        showOverdueMessage(targets.length + ' ' + (targets.length === 1 ? 'reminder' : 'reminders') + ' sent via ' + channels.join(' + ') + ' • ' + targets.length + ' ' + (targets.length === 1 ? 'borrower' : 'borrowers') + ' notified.','success');
    }

    closeModal('bulkRemindersModal');
    renderOverdueTable();
}

/* Kept for backwards compatibility - opens the bulk dispatch modal. */
function triggerBulkReminders(){
    openBulkRemindersModal();
}

function refreshOverdue(){
    ensureOverdueData();
    const group = document.getElementById('overdueBucketFilters');
    if(group){
        group.querySelectorAll('.overdue-seg').forEach((seg) => {
            seg.classList.toggle('active', seg.dataset.bucket === overdueState.bucket);
        });
    }
    renderOverdueTable();
    if(window.lucide) lucide.createIcons();
}
