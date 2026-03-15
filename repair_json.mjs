import fs from 'fs';

function repairMangledArray(mangled) {
    return mangled.map(entry => {
        // 모든 키와 값을 하나의 문자열로 합칩니다.
        // mangled entry look like: { "[": " {...", "__parsed_extra": ["...", "..."] }
        const values = Object.values(entry);
        let combined = values.join(',');
        
        // 콤마가 잘못 들어가서 찢어진 것이므로, 대괄호나 중괄호 밸런스를 맞추거나 
        // 단순히 JSON 객체 형태만 추출해봅니다.
        combined = combined.trim();
        if (combined.startsWith('[')) combined = combined.substring(1);
        if (combined.endsWith(']')) combined = combined.substring(0, combined.length - 1);
        if (combined.endsWith(',')) combined = combined.substring(0, combined.length - 1);
        
        try {
            return JSON.parse(combined);
        } catch (e) {
            // 파싱 실패 시 수동 복구 시도
            try {
                // 앞뒤 불필요 문자가 있을 수 있음
                const match = combined.match(/\{.*\}/);
                if (match) return JSON.parse(match[0]);
            } catch (e2) {
                console.error("Failed to repair entry:", combined);
                return null;
            }
        }
    }).filter(v => v !== null);
}

const filesToRepair = ['고정비.json', '결제내역.json'];

filesToRepair.forEach(filename => {
    try {
        const content = fs.readFileSync(filename, 'utf8');
        const mangled = JSON.parse(content);
        const repaired = repairMangledArray(mangled);
        
        fs.writeFileSync(filename, JSON.stringify(repaired, null, 2));
        console.log(`Successfully repaired ${filename}. Found ${repaired.length} clean entries.`);
    } catch (err) {
        console.error(`Repair failed for ${filename}:`, err.message);
    }
});
