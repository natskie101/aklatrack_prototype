function filterUsersTable(value){value=value.toLowerCase();document.querySelectorAll('#usersTableBody tr').forEach(r=>r.style.display=r.innerText.toLowerCase().includes(value)?'':'none');}
