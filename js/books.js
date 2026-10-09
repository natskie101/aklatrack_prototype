function filterBooksTable(value, categoryFilter = 'Category: All', statusFilter = 'Status: All') {
    const searchValue = String(value || '').trim().toLowerCase();
    const selectedCategory = String(categoryFilter || 'Category: All').replace('Category: ', '').trim();
    const selectedStatus = String(statusFilter || 'Status: All').replace('Status: ', '').trim();

    document.querySelectorAll('#booksTableBody tr').forEach((row) => {
        const rowText = row.innerText.toLowerCase();
        const rowCategory = (row.dataset.category || '').toLowerCase();
        const rowStatus = (row.dataset.status || '').toLowerCase();

        const matchesSearch = !searchValue || rowText.includes(searchValue);
        const matchesCategory = selectedCategory === 'All' || rowCategory === selectedCategory.toLowerCase();
        const matchesStatus = selectedStatus === 'All' || rowStatus === selectedStatus.toLowerCase();

        row.style.display = matchesSearch && matchesCategory && matchesStatus ? '' : 'none';
    });
}

function openInventoryCopyModal() {
    const form = document.querySelector('#inventoryCopyModal form');
    if (form) form.reset();
    openModal('inventoryCopyModal');
    document.getElementById('inventoryCopyLocation')?.focus();
}

function saveInventoryCopy(event) {
    event.preventDefault();

    const tbody = document.getElementById('inventoryCopyTableBody');
    const condition = document.getElementById('inventoryCopyCondition')?.value;
    const location = document.getElementById('inventoryCopyLocation')?.value.trim();
    if (!tbody || !condition || !location) return;

    const highestCopyNumber = Array.from(tbody.rows).reduce((highest, row) => {
        const match = row.cells[0]?.textContent.match(/(\d+)$/);
        return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    const copyId = 'CC-' + String(highestCopyNumber + 1).padStart(3, '0');
    const row = tbody.insertRow();
    row.insertCell().textContent = copyId;

    const conditionCell = row.insertCell();
    const conditionPill = document.createElement('span');
    conditionPill.className = 'copy-status-pill copy-status-' + condition.toLowerCase();
    conditionPill.textContent = condition;
    conditionCell.appendChild(conditionPill);

    row.insertCell().textContent = location;
    const actionCell = row.insertCell();
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'copy-remove-btn';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => row.remove());
    actionCell.appendChild(removeButton);

    const totalBooks = document.getElementById('inventoryTotalBooks');
    const copyState = document.getElementById('inventoryCopiesState');
    const totalCopies = tbody.rows.length;
    if (totalBooks) totalBooks.textContent = String(totalCopies);
    if (copyState) copyState.textContent = `${totalCopies} / ${totalCopies}`;

    closeModal('inventoryCopyModal');
}
