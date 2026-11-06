import { supabase } from './supabase.js';
import { isSiteAdmin } from './access.js';
import { initCollectorLog } from './collector-log.js';

let allSigners = [];

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

window.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    setupOwnerImport();
    initCollectorLog();
});

async function setupOwnerImport() {
    const section = document.getElementById('ownerCsvImport');
    if (!section || !await isSiteAdmin()) return;
    section.classList.remove('hidden');
    setupDragAndDrop();
}

async function loadDashboard() {
    const tbody = document.getElementById('dashboardTableBody') || document.querySelector('tbody');
    if (!tbody) return;

    const { data: signers, error } = await supabase
        .from('signers')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('Supabase Query Error:', error);
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-red-400 text-center">Error loading dashboard: ${escapeHtml(error.message)}</td></tr>`;
        return;
    }

    if (!signers || signers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-gray-400 text-center">No signers found in database.</td></tr>';
        return;
    }

    allSigners = signers;
    renderDashboardTable(allSigners);
}

function renderDashboardTable(data) {
    const tbody = document.getElementById('dashboardTableBody') || document.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = data.map(signer => {
        const name = String(signer.name || '');
        const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(name + ' autographed card')}&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=5339215575&customid=LegitimateCollector&toolid=10001&mkevt=1`;
        const sportlotsUrl = `https://www.sportlots.com/b/ui/search.tpl?search_val=${encodeURIComponent(name)}&Ref=Bets1202`;
        const scnUrl = `https://www.sportscollectors.net/Search.aspx?search=${encodeURIComponent(name)}`;

        return `
        <tr class="border-b border-darkBorder hover:bg-darkHover/50 transition-colors">
            <td class="px-6 py-4 font-semibold text-white">${escapeHtml(name || '-')}</td>
            <td class="px-6 py-4 text-gray-400">${escapeHtml(signer.sport || '-')} <span class="text-gray-500">/ ${escapeHtml(signer.team || '-')}</span></td>
            <td class="px-6 py-4"><span class="inline-flex items-center px-3 py-1 rounded-full bg-success/20 text-success text-sm font-semibold">${escapeHtml(signer.success_rate || 'N/A')}</span></td>
            <td class="px-6 py-4 text-gray-400">${escapeHtml(signer.avg_response || 'Pending')}</td>
            <td class="px-6 py-4 text-gray-400 text-xs font-mono truncate max-w-xs">${escapeHtml(signer.tested_address || '-')}</td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <a href="${ebayUrl}" rel="sponsored nofollow" class="px-3 py-1.5 bg-accent/10 border border-accent/30 text-accent font-semibold rounded-lg text-xs hover:bg-accent hover:text-white">eBay</a>
                    <a href="${sportlotsUrl}" rel="sponsored nofollow" class="px-3 py-1.5 bg-success/10 border border-success/30 text-success font-semibold rounded-lg text-xs hover:bg-success hover:text-white">Sportlots</a>
                    <a href="${scnUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 bg-darkCard border border-darkBorder text-gray-300 font-semibold rounded-lg text-xs hover:border-accent">SCN</a>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', event => {
        event.preventDefault();
        dropZone.classList.add('border-accent');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-accent'));
    dropZone.addEventListener('drop', event => {
        event.preventDefault();
        dropZone.classList.remove('border-accent');
        if (event.dataTransfer.files.length) parseAndUploadCSV(event.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', event => {
        if (event.target.files.length) parseAndUploadCSV(event.target.files[0]);
    });
}

async function parseAndUploadCSV(file) {
    const status = document.getElementById('uploadStatus');
    if (status) {
        status.textContent = `Parsing ${file.name}...`;
        status.classList.remove('hidden', 'text-red-400', 'text-green-400');
    }

    try {
        if (!await isSiteAdmin()) throw new Error('CSV import is available to the site owner only.');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error('Sign in with Google before uploading signer records.');

        const text = await file.text();
        if (!window.Papa) throw new Error('The CSV parser failed to load. Refresh the page and try again.');
        const parsed = window.Papa.parse(text, {
            header: true,
            skipEmptyLines: 'greedy',
            transformHeader: header => header.trim().toLowerCase()
        });
        if (parsed.errors.length) throw new Error(`Could not read CSV row ${parsed.errors[0].row + 1}: ${parsed.errors[0].message}`);
        if (!parsed.meta.fields || !parsed.meta.fields.includes('name')) throw new Error('CSV file needs a "name" column.');

        const supportedFields = ['name', 'sport', 'team', 'success_rate', 'avg_response', 'tested_address'];
        const rows = parsed.data
            .filter(row => String(row.name || '').trim())
            .map(row => Object.fromEntries(supportedFields
                .filter(field => parsed.meta.fields.includes(field))
                .map(field => [field, String(row[field] || '').trim()])));
        if (!rows.length) throw new Error('CSV file must contain a header row and at least one data row.');

        const { error } = await supabase.from('signers').insert(rows);
        if (error) throw error;
        if (status) {
            status.textContent = `Successfully uploaded ${rows.length} records.`;
            status.classList.add('text-green-400');
        }
        await loadDashboard();
    } catch (error) {
        if (status) {
            status.textContent = `Upload failed: ${error.message}`;
            status.classList.add('text-red-400');
        }
    }
}
