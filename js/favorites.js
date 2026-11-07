import { supabase } from './supabase.js';

const signInPanel = document.getElementById('signInPanel');
const content = document.getElementById('collectionContent');
const status = document.getElementById('statusMessage');
const searchInput = document.getElementById('signerSearch');
const searchResults = document.getElementById('searchResults');
const savedSigners = document.getElementById('savedSigners');

let user = null;
let savedIds = new Set();
let searchTimer;

function announce(message) {
    status.textContent = message;
}

function makeSignerCard(signer, saved = false) {
    const card = document.createElement('article');
    card.className = 'signer-card';

    const details = document.createElement('div');
    const name = document.createElement('h3');
    name.textContent = signer.name || 'Unnamed signer';
    details.append(name);

    const meta = document.createElement('p');
    meta.textContent = [signer.sport, signer.team].filter(Boolean).join(' · ') || 'Sport/team not listed';
    details.append(meta);

    const stats = document.createElement('p');
    const values = [
        signer.success_rate ? `Success: ${signer.success_rate}` : '',
        signer.avg_response ? `Average response: ${signer.avg_response}` : ''
    ].filter(Boolean);
    stats.textContent = values.join(' · ');
    if (values.length) details.append(stats);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = saved ? 'secondary-button' : 'primary-button';
    button.dataset.signerId = String(signer.id);
    button.dataset.action = saved ? 'remove' : 'save';
    button.textContent = saved ? 'Remove' : 'Save signer';
    button.setAttribute('aria-label', `${saved ? 'Remove' : 'Save'} ${signer.name || 'signer'} ${saved ? 'from' : 'to'} your saved signers`);

    card.append(details, button);
    return card;
}

async function loadSavedSigners() {
    savedSigners.replaceChildren();
    const { data: favorites, error } = await supabase
        .from('user_favorites')
        .select('signer_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
    if (error) throw error;

    const ids = (favorites || []).map(item => String(item.signer_id));
    savedIds = new Set(ids);
    if (!ids.length) {
        savedSigners.textContent = 'No saved signers yet. Search above to add one.';
        return;
    }

    const { data: signers, error: signerError } = await supabase
        .from('signers')
        .select('id, name, sport, team, success_rate, avg_response')
        .in('id', ids);
    if (signerError) throw signerError;

    const byId = new Map((signers || []).map(signer => [String(signer.id), signer]));
    ids.forEach(id => {
        const signer = byId.get(id);
        if (signer) savedSigners.append(makeSignerCard(signer, true));
    });
    if (!savedSigners.childElementCount) savedSigners.textContent = 'No saved signers found.';
}

async function searchSigners(query) {
    searchResults.replaceChildren();
    const term = query.trim();
    if (term.length < 2) {
        searchResults.textContent = 'Enter at least 2 characters to search.';
        return;
    }

    const { data, error } = await supabase
        .from('signers')
        .select('id, name, sport, team, success_rate, avg_response')
        .ilike('name', `%${term}%`)
        .order('name', { ascending: true })
        .limit(25);
    if (error) throw error;

    const results = (data || []).filter(signer => !savedIds.has(String(signer.id)));
    if (!results.length) {
        searchResults.textContent = 'No matching unsaved signers found.';
        return;
    }
    results.forEach(signer => searchResults.append(makeSignerCard(signer)));
}

async function toggleFavorite(button) {
    const signerId = button.dataset.signerId;
    button.disabled = true;
    try {
        if (button.dataset.action === 'save') {
            const { error } = await supabase.from('user_favorites').insert({
                user_id: user.id,
                signer_id: signerId
            });
            if (error) throw error;
            announce('Signer saved.');
        } else {
            const { error } = await supabase.from('user_favorites')
                .delete()
                .eq('user_id', user.id)
                .eq('signer_id', signerId);
            if (error) throw error;
            announce('Signer removed from your saved list.');
        }
        await loadSavedSigners();
        if (searchInput.value.trim().length >= 2) await searchSigners(searchInput.value);
    } catch (error) {
        console.error('Could not update saved signers:', error);
        announce('Could not update your saved signers. Please try again.');
        button.disabled = false;
    }
}

async function initialize() {
    document.getElementById('signInButton').addEventListener('click', async () => {
        const redirectTo = new URL('./favorites.html', window.location.href).toString();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo }
        });
        if (error) announce('Sign-in could not start. Please try again.');
    });

    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        user = session?.user || null;
        signInPanel.hidden = Boolean(user);
        content.hidden = !user;
        if (!user) return;

        announce('Loading your saved signers…');
        await loadSavedSigners();
        announce('Your saved signers are ready.');
        searchResults.textContent = 'Enter at least 2 characters to search.';
    } catch (error) {
        console.error('Could not load favorites:', error);
        if (content.hidden) signInPanel.hidden = false;
        announce('Could not load your saved signers. Check the favorites table and its access policies in Supabase.');
    }

    searchInput.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(async () => {
            try {
                await searchSigners(searchInput.value);
            } catch (error) {
                console.error('Signer search failed:', error);
                searchResults.textContent = 'Search failed. Please try again.';
            }
        }, 250);
    });

    document.addEventListener('click', event => {
        const button = event.target.closest('button[data-signer-id]');
        if (button && user) toggleFavorite(button);
    });
}

initialize();
