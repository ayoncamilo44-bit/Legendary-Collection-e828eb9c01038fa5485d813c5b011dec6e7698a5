// Load Papa Parse for the dashboard's CSV import. This file is loaded as a module
// before dashboard.js and exposes the parser where the existing importer expects it.
try {
    const { default: Papa } = await import('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm');
    window.Papa = Papa;
    window.dispatchEvent(new Event('csv-parser-ready'));
} catch (error) {
    console.error('Unable to load the CSV parser:', error);
    window.dispatchEvent(new CustomEvent('csv-parser-error', {
        detail: 'CSV import is unavailable because the parser could not load. Check your connection or browser content-blocking settings.'
    }));
}
