// Print support for dashboard letter/envelope layouts already present in dashboard.html.
// Any form can opt in by using data-print-letter and matching data-* values.
(function () {
    function setText(id, value) {
        var node = document.getElementById(id);
        if (node) node.textContent = value || '';
    }

    document.addEventListener('click', function (event) {
        var button = event.target.closest('[data-print-letter]');
        if (!button) return;

        var fields = ['date', 'recipientName', 'recipientAddress', 'salutation', 'senderName', 'senderAddress', 'items'];
        fields.forEach(function (field) {
            var targetIds = {
                date: ['print-date'],
                recipientName: ['print-recipient-name'],
                recipientAddress: ['print-recipient-address', 'print-envelope-recipient'],
                salutation: ['print-salutation'],
                senderName: ['print-sender-name'],
                senderAddress: ['print-sender-address', 'print-envelope-return'],
                items: ['print-items-enclosed']
            }[field];
            targetIds.forEach(function (id) { setText(id, button.dataset[field]); });
        });

        var format = button.dataset.format === 'envelope' ? 'envelope' : 'letter';
        document.body.classList.toggle('print-envelope', format === 'envelope');
        document.body.classList.toggle('print-letter', format === 'letter');
        window.print();
    });
})();
