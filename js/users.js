function filterUsersTable(value, roleFilter = 'All', statusFilter = 'All') {
    const searchValue = String(value || '').trim().toLowerCase();
    const selectedRole = String(roleFilter || 'All').trim();
    const selectedStatus = String(statusFilter || 'All').trim();

    document.querySelectorAll('#usersTableBody tr').forEach((row) => {
        const rowText = row.innerText.toLowerCase();
        const rowRole = (row.dataset.role || '').toLowerCase();
        const rowStatus = (row.dataset.status || '').toLowerCase();

        const matchesSearch = !searchValue || rowText.includes(searchValue);
        const matchesRole = selectedRole === 'All' || selectedRole.toLowerCase() === rowRole;
        const matchesStatus = selectedStatus === 'All' || selectedStatus.toLowerCase() === rowStatus;

        row.style.display = matchesSearch && matchesRole && matchesStatus ? '' : 'none';
    });
}
