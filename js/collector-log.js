import { supabase } from './supabase.js';

const STATUS_OPTIONS = [
    ['pending', 'Waiting for reply'],
    ['success', 'Success — signed'],
    ['no-response', 'No response'],
    ['returned', 'Returned unsigned']
];

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function statusOptions(selected) {
    return STATUS_OPTIONS.map(([value, label]) =>
        `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`
    ).join('');
}

export async function initCollectorLog() {
    const main = document.querySelector('main');
    if (!main) return;

    const section = document.createElement('section');
    section.className = 'glass-card rounded-2xl p-5 sm:p-8 mb-8';
    section.setAttribute('aria-labelledby', 'personal-log-heading');
    section.innerHTML = `
        <div class="mb-6">
            <p class="text-xs font-semibold tracking-widest uppercase text-accentHover mb-2">Your private tracker</p>
            <h2 id="personal-log-heading" class="text-2xl font-bold text-white">My TTM mailing log</h2>
            <p class="text-sm text-gray-400 mt-2">Record when you mailed a request and update its result later. Only you can see and edit your log.</p>
        </div>
        <form id="collectorLogForm" class="grid md:grid-cols-2 gap-4 mb-6">
            <div class="md:col-span-2"><label for="logSignerName" class="block text-sm font-medium text-gray-300 mb-2">Signer name *</label><input id="logSignerName" name="signer_name" maxlength="200" required class="w-full px-4 py-3 bg-darkBg/70 border border-darkBorder rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent" placeholder="e.g., Alex Morgan"></div>
            <div><label for="logDateSent" class="block text-sm font-medium text-gray-300 mb-2">Date mailed *</label><input id="logDateSent" name="date_sent" type="date" required class="w-full px-4 py-3 bg-darkBg/70 border border-darkBorder rounded-xl text-white focus:outline-none focus:border-accent"></div>
            <div><label for="logStatus" class="block text-sm font-medium text-gray-300 mb-2">Result</label><select id="logStatus" name="status" class="w-full px-4 py-3 bg-darkBg/70 border border-darkBorder rounded-xl text-white focus:outline-none focus:border-accent">${statusOptions('pending')}</select></div>
            <div><label for="logDateReceived" class="block text-sm font-medium text-gray-300 mb-2">Date received (optional)</label><input id="logDateReceived" name="date_received" type="date" class="w-full px-4 py-3 bg-darkBg/70 border border-darkBorder rounded-xl text-white focus:outline-none focus:border-accent"></div>
            <div><label for="logNotes" class="block text-sm font-medium text-gray-300 mb-2">Notes (optional)</label><input id="logNotes" name="notes" maxlength="1000" class="w-full px-4 py-3 bg-darkBg/70 border border-darkBorder rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent" placeholder="Keep private details out of shared information"></div>
            <p id="collectorLogStatus" class="hidden md:col-span-2 text-sm" role="status" aria-live="polite"></p>
            <div class="md:col-span-2"><button id="collectorLogSubmit" type="submit" class="px-5 py-3 gradient-bg text-white font-semibold rounded-xl hover:brightness-110 disabled:opacity-60">Add to my log</button></div>
        </form>
        <div class="border-t border-darkBorder pt-5">
            <h3 class="text-lg font-semibold text-white mb-4">My mailed requests</h3>
            <div id="collectorLogEntries" class="space-y-3" aria-live="polite"><p class="text-sm text-gray-400">Loading your log…</p></div>
        </div>`;

    const directorySection = main.querySelector('section.glass-card');
    main.insertBefore(section, directorySection || main.firstChild);

    const form = section.querySelector('#collectorLogForm');
    const status = section.querySelector('#collectorLogStatus');
    const entries = section.querySelector('#collectorLogEntries');
    const submit = section.querySelector('#collectorLogSubmit');

    const showMessage = (message, kind = 'error') => {
        status.textContent = message;
        status.classList.remove('hidden', 'text-red-300', 'text-emerald-300', 'text-amber-300');
        status.classList.add(kind === 'success' ? 'text-emerald-300' : kind === 'info' ? 'text-amber-300' : 'text-red-300');
    };

    const loadEntries = async () => {
        const { data, error } = await supabase.from('collector_ttm_logs')
            .select('id, signer_name, date_sent, status, date_received, notes')
            .order('date_sent', { ascending: false });
        if (error) throw error;
        entries.innerHTML = data.length ? data.map(entry => `
            <article class="rounded-xl border border-darkBorder bg-darkBg/50 p-4" data-log-id="${escapeHtml(entry.id)}">
                <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div><label class="block text-xs text-gray-400 mb-1">Signer</label><input data-field="signer_name" maxlength="200" value="${escapeHtml(entry.signer_name)}" class="w-full px-3 py-2 bg-darkBg border border-darkBorder rounded-lg text-white"></div>
                    <div><label class="block text-xs text-gray-400 mb-1">Date mailed</label><input data-field="date_sent" type="date" required value="${escapeHtml(entry.date_sent)}" class="w-full px-3 py-2 bg-darkBg border border-darkBorder rounded-lg text-white"></div>
                    <div><label class="block text-xs text-gray-400 mb-1">Result</label><select data-field="status" class="w-full px-3 py-2 bg-darkBg border border-darkBorder rounded-lg text-white">${statusOptions(entry.status)}</select></div>
                    <div><label class="block text-xs text-gray-400 mb-1">Date received</label><input data-field="date_received" type="date" value="${escapeHtml(entry.date_received || '')}" class="w-full px-3 py-2 bg-darkBg border border-darkBorder rounded-lg text-white"></div>
                    <div class="md:col-span-2 lg:col-span-3"><label class="block text-xs text-gray-400 mb-1">Notes</label><input data-field="notes" maxlength="1000" value="${escapeHtml(entry.notes || '')}" class="w-full px-3 py-2 bg-darkBg border border-darkBorder rounded-lg text-white"></div>
                    <div class="flex items-end gap-2"><button type="button" data-log-save class="px-4 py-2 rounded-lg bg-accent text-white font-semibold">Save</button><button type="button" data-log-delete class="px-4 py-2 rounded-lg border border-darkBorder text-gray-300 hover:bg-red-950">Delete</button></div>
                </div>
                <p data-row-message class="hidden mt-3 text-sm" role="status" aria-live="polite"></p>
            </article>`).join('') : '<p class="text-sm text-gray-400">No mailing records yet. Add your first request above.</p>';
    };

    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session) {
            form.innerHTML = '<p class="md:col-span-2 text-sm text-gray-300">Sign in to add and manage your personal TTM mailing log.</p><a href="./admin.html" class="inline-flex px-4 py-2 rounded-lg bg-accent text-white font-semibold">Sign in</a>';
            entries.innerHTML = '<p class="text-sm text-gray-400">Sign in to view your private mailing records.</p>';
            return;
        }
        await loadEntries();
    } catch (error) {
        console.error('Unable to load personal mailing log:', error);
        entries.innerHTML = '<p class="text-sm text-red-300">Could not load your log. Please refresh and try again.</p>';
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();
        submit.disabled = true;
        const values = new FormData(form);
        const record = {
            signer_name: String(values.get('signer_name') || '').trim(),
            date_sent: String(values.get('date_sent') || ''),
            status: String(values.get('status') || 'pending'),
            date_received: String(values.get('date_received') || '') || null,
            notes: String(values.get('notes') || '').trim() || null
        };
        try {
            const { error } = await supabase.from('collector_ttm_logs').insert(record);
            if (error) throw error;
            form.reset();
            form.elements.status.value = 'pending';
            showMessage('Mailing record added.', 'success');
            await loadEntries();
        } catch (error) {
            console.error('Unable to add mailing record:', error);
            showMessage('Could not add this record. Check the Supabase setup and try again.');
        } finally {
            submit.disabled = false;
        }
    });

    entries.addEventListener('click', async event => {
        const saveButton = event.target.closest('[data-log-save]');
        const deleteButton = event.target.closest('[data-log-delete]');
        if (!saveButton && !deleteButton) return;
        const article = event.target.closest('[data-log-id]');
        const rowMessage = article.querySelector('[data-row-message]');
        const id = article.dataset.logId;
        const button = saveButton || deleteButton;
        button.disabled = true;
        try {
            if (deleteButton) {
                if (!window.confirm('Delete this mailing record?')) return;
                const { error } = await supabase.from('collector_ttm_logs').delete().eq('id', id);
                if (error) throw error;
                await loadEntries();
                return;
            }
            const value = field => article.querySelector(`[data-field="${field}"]`).value;
            const update = {
                signer_name: value('signer_name').trim(),
                date_sent: value('date_sent'),
                status: value('status'),
                date_received: value('date_received') || null,
                notes: value('notes').trim() || null
            };
            const { error } = await supabase.from('collector_ttm_logs').update(update).eq('id', id);
            if (error) throw error;
            rowMessage.textContent = 'Changes saved.';
            rowMessage.className = 'mt-3 text-sm text-emerald-300';
        } catch (error) {
            console.error('Unable to update mailing record:', error);
            rowMessage.textContent = 'Could not save this record. Please try again.';
            rowMessage.className = 'mt-3 text-sm text-red-300';
        } finally {
            button.disabled = false;
        }
    });
}
