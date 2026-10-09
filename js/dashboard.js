/* Dashboard - all cards and charts are computed from the live modules
   (Book Management, Borrowing, Overdue Monitoring, Borrowers, Reports)
   instead of hardcoded placeholder numbers. */

function parseDashboardNumber(text) {
    const cleaned = String(text || '').replace(/[^0-9]/g, '');
    return cleaned ? Number(cleaned) : 0;
}

function getDashboardBooksData() {
    const summaryStrong = document.querySelectorAll('#books .book-summary-card strong');
    let total = summaryStrong[0] ? parseDashboardNumber(summaryStrong[0].textContent) : 0;
    let issued = summaryStrong[1] ? parseDashboardNumber(summaryStrong[1].textContent) : 0;
    let titles = 0;
    const footer = document.querySelector('#books .books-table-footer span');
    if (footer) {
        const match = footer.textContent.match(/of\s+(\d+)/);
        if (match) titles = Number(match[1]);
    }
    if (!total) {
        document.querySelectorAll('#booksTableBody tr').forEach((row) => {
            const cell = row.children[3];
            if (!cell) return;
            const totalMatch = cell.textContent.match(/\((\d+)\s*Total\)/);
            if (totalMatch) total += Number(totalMatch[1]);
        });
        titles = document.querySelectorAll('#booksTableBody tr').length;
    }
    return { total: total, issued: issued, titles: titles, available: Math.max(total - issued, 0) };
}

function getDashboardUsersData() {
    const rows = document.querySelectorAll('#usersTableBody tr');
    let active = 0;
    let suspended = 0;
    rows.forEach((row) => {
        const status = String(row.dataset.status || '').toLowerCase();
        if (status === 'suspended') suspended += 1;
        else active += 1;
    });
    if (!rows.length) {
        const numbers = document.querySelectorAll('.user-stats-grid .stat-number');
        if (numbers[0]) active = parseDashboardNumber(numbers[0].textContent);
        if (numbers[1]) suspended = parseDashboardNumber(numbers[1].textContent);
    }
    return { total: active + suspended, active: active, suspended: suspended };
}

function getDashboardOverdueData() {
    if (typeof ensureOverdueData === 'function') {
        const records = ensureOverdueData();
        const critical = records.filter((record) => getOverdueDays(record) > 30).length;
        return { total: records.length, critical: critical };
    }
    return { total: 0, critical: 0 };
}

function updateDashboardCards() {
    const books = getDashboardBooksData();
    const users = getDashboardUsersData();
    const overdue = getDashboardOverdueData();

    const totalEl = document.getElementById('dashboardTotalBooks');
    const borrowedEl = document.getElementById('dashboardBorrowedBooks');
    const overdueEl = document.getElementById('dashboardOverdue');
    const usersEl = document.getElementById('dashboardUsers');
    const totalNoteEl = document.getElementById('dashboardTotalBooksNote');
    const borrowedNoteEl = document.getElementById('dashboardBorrowedBooksNote');
    const overdueNoteEl = document.getElementById('dashboardOverdueNote');
    const usersNoteEl = document.getElementById('dashboardUsersNote');

    if (totalEl) totalEl.textContent = books.total.toLocaleString('en-US');
    if (borrowedEl) borrowedEl.textContent = books.issued.toLocaleString('en-US');
    if (overdueEl) overdueEl.textContent = overdue.total.toLocaleString('en-US');
    if (usersEl) usersEl.textContent = users.total.toLocaleString('en-US');
    if (totalNoteEl) totalNoteEl.textContent = books.titles ? books.titles + ' titles in catalog' : 'All catalogued copies';
    if (borrowedNoteEl) borrowedNoteEl.textContent = 'Copies issued to borrowers';
    if (overdueNoteEl) overdueNoteEl.textContent = overdue.critical + ' critical (30+ days)';
    if (usersNoteEl) usersNoteEl.textContent = users.active + ' active · ' + users.suspended + ' suspended';
}

function getDashboardCirculation() {
    const labels = [];
    const borrowed = [];
    const returned = [];
    const records = typeof getReportRecords === 'function' ? getReportRecords() : [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    for (let offset = 5; offset >= 0; offset -= 1) {
        const date = new Date(today.getTime());
        date.setDate(date.getDate() - offset);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        if (records.length) {
            borrowed.push(records.filter((r) => r.type === 'borrow' && isSameDay(r.date, date)).length);
            returned.push(records.filter((r) => r.type === 'return' && isSameDay(r.date, date)).length);
        } else {
            borrowed.push(0);
            returned.push(0);
        }
    }
    return { labels: labels, borrowed: borrowed, returned: returned };
}

function renderDashboardChart() {
    const circulationCanvas = document.getElementById('circulationChart');
    const statusCanvas = document.getElementById('statusChart');
    if (!circulationCanvas || !statusCanvas || !window.Chart) return;

    const books = getDashboardBooksData();
    const overdue = getDashboardOverdueData();
    const circulation = getDashboardCirculation();
    const onShelf = Math.max(books.total - books.issued - overdue.total, 0);

    if (circulationBarChartInstance) circulationBarChartInstance.destroy();
    if (dashboardPieChartInstance) dashboardPieChartInstance.destroy();

    circulationBarChartInstance = new Chart(circulationCanvas, {
        type: 'bar',
        data: {
            labels: circulation.labels,
            datasets: [
                { label: 'Borrowed', data: circulation.borrowed, backgroundColor: '#2563eb', borderRadius: 6 },
                { label: 'Returned', data: circulation.returned, backgroundColor: '#10b981', borderRadius: 6 }
            ]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
            plugins: { legend: { position: 'bottom' } }
        }
    });

    dashboardPieChartInstance = new Chart(statusCanvas, {
        type: 'doughnut',
        data: {
            labels: [
                'Available (' + onShelf.toLocaleString('en-US') + ')',
                'On Loan (' + books.issued.toLocaleString('en-US') + ')',
                'Overdue (' + overdue.total.toLocaleString('en-US') + ')'
            ],
            datasets: [{
                data: [onShelf, books.issued, overdue.total],
                backgroundColor: ['#10b981', '#2563eb', '#ef4444'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            cutout: '62%',
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function refreshDashboard() {
    updateDashboardCards();
    renderDashboardChart();
}
