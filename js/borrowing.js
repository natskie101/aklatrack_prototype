<<<<<<< HEAD
function refreshBorrowing(){
    if(window.lucide)lucide.createIcons();
    filterBorrowingRows();
}

function getBorrowingRowStatus(row){
    const pill = row.querySelector('.status-pill');
    const label = (pill ? pill.textContent.trim() : '').toLowerCase();
    if(label.includes('overdue')) return 'overdue';
    if(label.includes('returned')) return 'returned';
    if(label.includes('due soon')) return 'due-soon';
    if(label.includes('borrowed')) return 'borrowed';
    if(label.includes('active')) return 'borrowed';
    return 'borrowed';
}

function parseBorrowDate(dateText){
    if(!dateText || dateText.trim() === '—') return null;
    const cleaned = dateText.trim();
    const parsed = new Date(cleaned);
    if(!isNaN(parsed.getTime())) return parsed;
    const parts = cleaned.split(/\s+/);
    if(parts.length >= 3){
        const monthMap = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
        const month = monthMap[parts[0]];
        const day = Number(parts[1].replace(',',''));
        const year = Number(parts[2]);
        if(!Number.isNaN(month) && !Number.isNaN(day) && !Number.isNaN(year)){
            return new Date(year, month, day);
        }
    }
    return null;
}

function filterBorrowingRows(){
    const searchInput = document.getElementById('borrowSearchInput');
    const statusFilter = document.getElementById('borrowStatusFilter');
    const dateFilter = document.getElementById('borrowDateFilter');
    const rows = document.querySelectorAll('#borrowing .borrowing-table tbody tr');
    const query = (searchInput?.value || '').trim().toLowerCase();
    const statusValue = statusFilter?.value || 'all';
    const dateValue = dateFilter?.value || 'all';
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let visibleCount = 0;
    rows.forEach((row)=>{
        const text = row.textContent.toLowerCase();
        const matchesSearch = !query || text.includes(query);
        const status = getBorrowingRowStatus(row);
        const matchesStatus = statusValue === 'all' || status === statusValue;

        let matchesDate = true;
        const borrowDate = parseBorrowDate(row.children[3]?.textContent || '');
        if(dateValue !== 'all' && borrowDate){
            const diffDays = Math.floor((today - borrowDate) / (1000*60*60*24));
            if(dateValue === 'this-week') matchesDate = diffDays >= 0 && diffDays <= 7;
            if(dateValue === 'this-month') matchesDate = borrowDate.getMonth() === currentMonth && borrowDate.getFullYear() === currentYear;
            if(dateValue === 'previous-month'){
                const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
                matchesDate = borrowDate.getMonth() === previousMonth && borrowDate.getFullYear() === previousYear;
            }
        }

        if(matchesSearch && matchesStatus && matchesDate){
            row.classList.remove('hidden');
            visibleCount += 1;
        } else {
            row.classList.add('hidden');
        }
    });

    const activeCount = [...rows].filter((row) => {
        if (row.classList.contains('hidden')) return false;
        const status = getBorrowingRowStatus(row);
        return ['borrowed','due-soon'].includes(status);
    }).length;

    const overdueCount = [...rows].filter((row) => !row.classList.contains('hidden') && getBorrowingRowStatus(row) === 'overdue').length;
    const returnedCount = [...rows].filter((row) => !row.classList.contains('hidden') && getBorrowingRowStatus(row) === 'returned').length;

    const activeEl = document.getElementById('borrowingActiveCount');
    const overdueEl = document.getElementById('borrowingOverdueCount');
    const returnedEl = document.getElementById('borrowingReturnedCount');
    if(activeEl) activeEl.textContent = String(activeCount);
    if(overdueEl) overdueEl.textContent = String(overdueCount);
    if(returnedEl) returnedEl.textContent = String(returnedCount);

    const countText = document.querySelector('#borrowing .borrowing-pagination span');
    if(countText){
        countText.textContent = visibleCount ? `Showing 1 - ${visibleCount} of ${visibleCount} records` : 'Showing 0 records';
    }

    return visibleCount;
}

function openBorrowCheckoutModal(){
    const borrowDate = document.getElementById('borrowCheckoutBorrowDate');
    const dueDate = document.getElementById('borrowCheckoutDueDate');
    if (borrowDate && !borrowDate.value) {
        const today = new Date();
        const isoToday = today.toISOString().split('T')[0];
        borrowDate.value = isoToday;
        const due = new Date(today);
        due.setDate(due.getDate() + 14);
        dueDate.value = due.toISOString().split('T')[0];
    }
    openModal('borrowCheckoutModal');
}

function submitBorrowCheckout(event){
    event.preventDefault();

    const borrowerId = document.getElementById('borrowCheckoutBorrower')?.value?.trim() || 'STUDENT';
    const borrowerName = document.getElementById('borrowCheckoutBorrowerName')?.value?.trim() || 'Borrower';
    const bookTitle = document.getElementById('borrowCheckoutBookTitle')?.value?.trim() || 'Book Title';
    const borrowDateValue = document.getElementById('borrowCheckoutBorrowDate')?.value || '';
    const dueDateValue = document.getElementById('borrowCheckoutDueDate')?.value || '';

    const tbody = document.querySelector('#borrowing .borrowing-table tbody');
    if (!tbody) return;

    const nextId = 'TX-' + String(tbody.children.length + 9401).slice(-4);
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${nextId}</td>
        <td>
            <div class="borrower-name">${borrowerName}</div>
            <div class="borrower-sub">Student ID ${borrowerId}</div>
        </td>
        <td>
            <div class="book-title">${bookTitle}</div>
            <div class="book-author">by Borrower entry</div>
        </td>
        <td>${formatBorrowDate(borrowDateValue)}</td>
        <td>${formatBorrowDate(dueDateValue)}</td>
        <td>—</td>
        <td><span class="status-pill borrowed">Borrowed</span></td>
    `;

    tbody.insertBefore(row, tbody.firstChild);
    closeModal('borrowCheckoutModal');
    event.target.reset();
    filterBorrowingRows();
}

function formatBorrowDate(value){
    if (!value) return '—';
    const date = new Date(value + 'T00:00:00');
    return isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
}
=======
function refreshBorrowing(){if(window.lucide)lucide.createIcons();}
>>>>>>> dea7d19fa916acf3b8cc95162ae059e3cfdf773d
