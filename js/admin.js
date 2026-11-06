import { supabase } from './supabase.js';
import { isSiteAdmin } from './access.js';

const status = document.getElementById('adminStatus');
const queues = document.getElementById('adminQueues');

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function card(content, row) {
    return `<article class="rounded-xl border border-darkBorder bg-darkBg/60 p-5">
        <div>${content}</div>
        <p class="text-xs text-gray-500 mt-3">Submitted ${escapeHtml(row.created_at ? new Date(row.created_at).toLocaleString() : '')}</p>
        <div class="flex flex-wrap gap-3 mt-4">
            <button type="button" class="review-action px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold" data-id="${escapeHtml(row.id)}" data-action="approve">Approve</button>
            <button type="button" class="review-action px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold" data-id="${escapeHtml(row.id)}" data-action="reject">Reject</button>
        </div>
    </article>`;
}

function renderSigner(row) {
    const address = row.tested_address
        ? `<p class="text-sm text-gray-300 mt-2">Public address: ${escapeHtml(row.tested_address)}</p>`
        : '<p class="text-sm text-gray-400 mt-2">No public address supplied</p>';
    const source = row.source_url
        ? `<p class="text-sm text-gray-400 mt-2">Source: <a href="${escapeHtml(row.source_url)}" target="_blank" rel="noopener noreferrer" class="text-accentHover underline">${escapeHtml(row.source_url)}</a></p>`
        : '<p class="text-sm text-amber-300 mt-2">No source URL supplied</p>';
    const date = row.source_date
        ? `<p class="text-sm text-gray-400 mt-2">Source date: ${escapeHtml(row.source_date)}</p>`
        : '<p class="text-sm text-gray-400 mt-2">No source date supplied</p>';
    return card(`<h3 class="text-lg font-semibold text-white">${escapeHtml(row.name)}</h3>
        <p class="text-gray-300">${escapeHtml(row.sport)}${row.team ? ` · ${escapeHtml(row.team)}` : ''}</p>${address}${source}${date}`, row);
}

async function loadQueues() {
    const target = document.getElementById('signerQueue');
    const count = document.getElementById('signerCount');
    const { data, error } = await supabase.from('signer_submissions')
        .select('id, name, sport, team, success_rate, avg_response, tested_address, source_url, source_date, created_at')
        .eq('status', 'pending').order('created_at', { ascending: true });
    if (error) throw error;
    count.textContent = `(${data.length})`;
    target.innerHTML = data.length ? data.map(renderSigner).join('') : '<p class="text-gray-400 text-sm">Nothing waiting for review.</p>';
}

document.addEventListener('click', async event => {
    const button = event.target.closest('.review-action');
    if (!button) return;
    button.disabled = true;
    status.textContent = 'Saving your review…';
    try {
        const { error } = await supabase.rpc('review_signer_submission', {
            p_submission_id: button.dataset.id,
            p_approve: button.dataset.action === 'approve'
        });
        if (error) throw error;
        status.textContent = button.dataset.action === 'approve' ? 'Approved.' : 'Rejected.';
        await loadQueues();
    } catch (error) {
        console.error('Could not review submission:', error);
        status.textContent = `Could not save the review: ${error.message || 'Database error'}`;
        button.disabled = false;
    }
});

document.getElementById('signOutButton')?.addEventListener('click', () => window.logout());

window.addEventListener('DOMContentLoaded', async () => {
    if (!status || !queues) return;
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        status.textContent = 'Sign in with the site owner account to continue.';
        const signIn = document.createElement('button');
        signIn.className = 'mt-4 px-4 py-2 rounded-lg bg-accent text-white font-semibold';
        signIn.textContent = 'Sign in with Google';
        signIn.addEventListener('click', () => window.loginWithGoogle());
        status.append(signIn);
        return;
    }
    if (!await isSiteAdmin()) {
        status.textContent = 'This page is restricted to the site owner.';
        return;
    }
    status.textContent = 'Owner access confirmed.';
    queues.classList.remove('hidden');
    try {
        await loadQueues();
    } catch (error) {
        console.error('Could not load the moderation queue:', error);
        status.textContent = `Could not load submissions: ${error.message || 'Database error'}`;
    }
});
