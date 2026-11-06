import { supabase } from './supabase.js';

const form = document.getElementById('addSignerForm');
const status = document.getElementById('signerFormStatus');
const submitButton = document.getElementById('signerSubmitButton');

function showStatus(message, kind = 'error') {
    status.textContent = message;
    status.classList.remove('hidden', 'text-red-300', 'text-emerald-300', 'text-amber-300');
    status.classList.add(kind === 'success' ? 'text-emerald-300' : kind === 'info' ? 'text-amber-300' : 'text-red-300');
    status.focus();
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    status.classList.add('hidden');

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
        showStatus('We could not verify your sign-in. Please refresh and try again.');
        return;
    }
    if (!session) {
        showStatus('Please sign in with Google before submitting a signer suggestion.', 'info');
        return;
    }

    const values = new FormData(form);
    const sourceUrl = String(values.get('source_url') || '').trim();
    try {
        const parsedSource = new URL(sourceUrl);
        if (parsedSource.protocol !== 'https:' && parsedSource.protocol !== 'http:') throw new Error('Invalid protocol');
    } catch {
        showStatus('Enter a valid public source URL beginning with http:// or https://.');
        document.getElementById('sourceUrl').focus();
        return;
    }

    const submission = {
        user_id: session.user.id,
        name: String(values.get('name') || '').trim(),
        sport: String(values.get('sport') || '').trim(),
        team: String(values.get('team') || '').trim() || null,
        success_rate: String(values.get('success_rate') || '').trim() || null,
        avg_response: String(values.get('avg_response') || '').trim() || null,
        tested_address: String(values.get('tested_address') || '').trim() || null,
        source_url: sourceUrl,
        source_date: String(values.get('source_date') || '').trim() || null,
        status: 'pending'
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting…';
    try {
        const { error } = await supabase.from('signer_submissions').insert(submission);
        if (error) throw error;
        form.reset();
        showStatus('Thanks! Your signer suggestion was submitted for owner review.', 'success');
    } catch (error) {
        console.error('Could not submit signer suggestion:', error);
        const message = error?.message || '';
        showStatus(message.includes('Daily submission limit')
            ? 'You have reached the daily contribution limit. Please try again later.'
            : 'We could not submit your suggestion. Please try again in a moment.');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i data-lucide="send" class="w-5 h-5" aria-hidden="true"></i>Submit suggestion';
        if (window.lucide) window.lucide.createIcons();
    }
});
