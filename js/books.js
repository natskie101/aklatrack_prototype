<<<<<<< HEAD
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
=======
function filterBooksTable(value){value=value.toLowerCase();document.querySelectorAll('#booksTableBody tr').forEach(r=>r.style.display=r.innerText.toLowerCase().includes(value)?'':'none');}
>>>>>>> dea7d19fa916acf3b8cc95162ae059e3cfdf773d
