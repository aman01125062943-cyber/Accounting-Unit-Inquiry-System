const extractReturnCode = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const s = String(val).trim();

    const lowerS = s.toLowerCase();

    // 1. Check for Army-c-
    if (lowerS.startsWith('army-c-')) {
        const parts = s.split('-');
        if (parts.length >= 3) {
            return parts[2].trim();
        }
    }

    // 2. Check for Army- (and NOT Army-c-)
    if (lowerS.startsWith('army-')) {
        const parts = s.split('-');
        if (parts.length >= 2) {
            return parts[1].trim();
        }
    }

    // 3. Check for standard dash separation e.g. 123-456
    if (s.includes('-')) {
        const parts = s.split('-');
        if (parts.length >= 2) return parts[1].trim();
    }

    return s;
}

console.log("Testing extract algorithm with split:");
console.log("Army-c-463-7-02-2026 ->", extractReturnCode("Army-c-463-7-02-2026"));
console.log("Army-8001012600641-02-2026 ->", extractReturnCode("Army-8001012600641-02-2026"));
console.log("Army-c-448-46-12-2025 -> ", extractReturnCode("Army-c-448-46-12-2025"));
console.log("123-456 ->", extractReturnCode("123-456"));
