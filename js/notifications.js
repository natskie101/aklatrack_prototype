/* Notifications - generated from the live module state (overdue, returns,
   borrowing, reports) plus session events pushed by actions. */

const NOTIFICATION_META = {
    overdue: { icon: 'triangle-alert', source: 'Overdue Monitoring' },
    reminder: { icon: 'bell-ring', source: 'Overdue Monitoring' },
    return: { icon: 'rotate-ccw', source: 'Return Book' },
    borrow: { icon: 'book-copy', source: 'Borrowing' },
    system: { icon: 'info', source: 'System' }
};

let notificationSessionLog = [];
let notificationReadIds = new Set();
let notificationFirstSeen = new Map();
let notificationSequence = 0;

function getNotificationTime(id) {
    if (!notificationFirstSeen.has(id)) notificationFirstSeen.set(id, new Date());
    return notificationFirstSeen.get(id);
}

function formatNotificationTime(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return diffMin + 'm ago';
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return diffHours + 'h ago';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildStateNotifications() {
    const items = [];

    if (typeof ensureOverdueData === 'function') {
        try {
            const records = ensureOverdueData();
            const critical = records.filter((record) => getOverdueDays(record) > 30);
            if (critical.length) {
                const worst = critical.reduce((a, b) => (getOverdueDays(b) > getOverdueDays(a) ? b : a));
                const days = getOverdueDays(worst);
                items.push({
                    id: 'overdue-critical',
                    type: 'overdue',
                    title: 'Critically Overdue Books',
                    message: critical.length + ' books are 30+ days overdue. ' + worst.borrowId + ' (' + worst.borrower + ') is ' + days + ' days late with ' + formatOverduePeso(getOverduePenalty(days)) + ' accrued.',
                    time: getNotificationTime('overdue-critical')
                });
            }
            const pendingNotices = records.filter((record) => record.noticeStatus === 'Pending').length;
            if (pendingNotices) {
                items.push({
                    id: 'overdue-notices',
                    type: 'reminder',
                    title: 'Reminders Awaiting Dispatch',
                    message: pendingNotices + ' notice' + (pendingNotices === 1 ? '' : 's') + ' still pending in Overdue Monitoring. Open Send Bulk Reminders to dispatch them.',
                    time: getNotificationTime('overdue-notices')
                });
            }
        } catch (error) { /* overdue module not ready */ }
    }

    try {
        const pendingEl = document.getElementById('returnsPendingCount');
        const todayEl = document.getElementById('returnsTodayCount');
        const pending = pendingEl ? Number(pendingEl.textContent) : 0;
        const returnedToday = todayEl ? Number(todayEl.textContent) : 0;
        if (pending > 0) {
            items.push({
                id: 'returns-pending',
                type: 'return',
                title: 'Pending Returns',
                message: pending + ' borrowed book' + (pending === 1 ? ' is' : 's are') + ' still awaiting a return in the Return Book module.',
                time: getNotificationTime('returns-pending')
            });
        }
        if (returnedToday > 0) {
            items.push({
                id: 'returns-today',
                type: 'return',
                title: 'Returns Processed Today',
                message: returnedToday + ' book' + (returnedToday === 1 ? '' : 's') + ' returned and processed today.',
                time: getNotificationTime('returns-today')
            });
        }
    } catch (error) { /* returns module not ready */ }

    try {
        const dueSoonRows = document.querySelectorAll('#borrowing .borrowing-table tbody tr .status-pill.due-soon');
        const overdueRows = document.querySelectorAll('#borrowing .borrowing-table tbody tr .status-pill.overdue');
        const dueSoonTotal = dueSoonRows.length;
        if (dueSoonTotal > 0) {
            items.push({
                id: 'borrow-due-soon',
                type: 'borrow',
                title: 'Borrowals Due Soon',
                message: dueSoonTotal + ' book' + (dueSoonTotal === 1 ? '' : 's') + ' from the Borrowing list ' + (dueSoonTotal === 1 ? 'is' : 'are') + ' due soon' + (overdueRows.length ? ' and ' + overdueRows.length + ' more overdue' : '') + '.',
                time: getNotificationTime('borrow-due-soon')
            });
        }
    } catch (error) { /* borrowing module not ready */ }

    try {
        if (typeof getReportRecords === 'function') {
            const todayOffset = getReportToday();
            const todays = getReportRecords().filter((record) => isSameReportDay(record.date, todayOffset));
            const borrows = todays.filter((r) => r.type === 'borrow').length;
            const returns = todays.filter((r) => r.type === 'return').length;
            if (todays.length) {
                items.push({
                    id: 'activity-today',
                    type: 'system',
                    title: "Today's Activity",
                    message: borrows + ' borrow' + (borrows === 1 ? '' : 's') + ' and ' + returns + ' return' + (returns === 1 ? '' : 's') + ' recorded for ' + formatReportDate(todayOffset) + '.',
                    time: getNotificationTime('activity-today')
                });
            }
        }
    } catch (error) { /* reports module not ready */ }

    return items;
}

function getNotificationItems() {
    return buildStateNotifications().concat(notificationSessionLog).sort((a, b) => b.time - a.time);
}

function pushNotification(type, title, message) {
    notificationSequence += 1;
    notificationSessionLog.unshift({
        id: 'event-' + notificationSequence,
        type: NOTIFICATION_META[type] ? type : 'system',
        title: title,
        message: message,
        time: new Date(),
        session: true
    });
    if (notificationSessionLog.length > 20) notificationSessionLog.length = 20;
    renderNotifications();
    updateNotificationsBadge();
}

function getUnreadNotificationCount() {
    return getNotificationItems().filter((item) => !notificationReadIds.has(item.id)).length;
}

function updateNotificationsBadge() {
    const unread = getUnreadNotificationCount();
    const sidebarBadge = document.getElementById('navNotificationsBadge');
    const unreadLabel = document.getElementById('notificationsUnread');
    if (sidebarBadge) {
        sidebarBadge.textContent = String(unread);
        sidebarBadge.classList.toggle('hidden', unread === 0);
    }
    if (unreadLabel) unreadLabel.textContent = unread > 0 ? unread + ' unread' : 'All caught up';
}

function renderNotifications() {
    const list = document.getElementById('notificationsList');
    const empty = document.getElementById('notificationsEmpty');
    if (!list) return;
    const items = getNotificationItems();

    list.innerHTML = items.map((item) => {
        const meta = NOTIFICATION_META[item.type] || NOTIFICATION_META.system;
        const isUnread = !notificationReadIds.has(item.id);
        const rowClass = isUnread ? 'notification-item is-unread' : 'notification-item';
        return `
            <article class="${rowClass} ${item.session ? 'is-session' : ''}" data-notification-id="${item.id}" onclick="markNotificationRead('${item.id}')" role="button" tabindex="0" title="Mark as read">
                <div class="notification-icon type-${item.type}"><i data-lucide="${meta.icon}"></i></div>
                <div class="notification-body">
                    <div class="notification-head">
                        <h4>${item.title}</h4>
                        <span class="notification-time">${formatNotificationTime(item.time)}</span>
                    </div>
                    <p class="notification-message">${item.message}</p>
                    <span class="notification-source">${meta.source}</span>
                </div>
                ${isUnread ? '<span class="notification-dot" aria-label="Unread"></span>' : ''}
            </article>
        `;
    }).join('');

    if (empty) empty.classList.toggle('hidden', items.length > 0);
    if (window.lucide) lucide.createIcons();
}

function refreshNotifications() {
    renderNotifications();
    updateNotificationsBadge();
}

function markNotificationsRead() {
    getNotificationItems().forEach((item) => notificationReadIds.add(item.id));
    refreshNotifications();
}

function markNotificationRead(id) {
    notificationReadIds.add(id);
    refreshNotifications();
}
