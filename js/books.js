function filterBooksTable(value){value=value.toLowerCase();document.querySelectorAll('#booksTableBody tr').forEach(r=>r.style.display=r.innerText.toLowerCase().includes(value)?'':'none');}
