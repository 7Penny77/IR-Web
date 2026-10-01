/*
 * 各系所減授評估
 * - 即時試算教師供給時數與系所開課需求
 * - 四個指定系所提供必修課程預設值；開課總門數一律留白
 * - 提交介面預留 Google Apps Script Web App endpoint
 */

const EVALUATION_GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxIhadAIW99JFxV4J_DO2FKfsbVUNrF53dRNZTcvhLUlmNdlblsnjfQWOPSSPi9mepW/exec';

const EVALUATION_DEFAULT_REQUIRED_COURSES = {
    '經濟學系': {
        '大一': [
            ['經濟學原理', 8],
            ['資料科學程式設計（一）', 2]
        ],
        '大二': [
            ['個體經濟學', 6],
            ['總體經濟學', 6]
        ],
        '大三': [
            ['公共經濟學', 4],
            ['國際經濟學', 4],
            ['貨幣銀行學', 4],
            ['經濟思想史', 4]
        ],
        '大四': [
            ['商事法', 3]
        ]
    },
    '財政學系': {
        '大一': [
            ['經濟學', 6],
            ['會計學', 6],
            ['統計學', 4],
            ['微積分', 6],
            ['民法概要', 3]
        ],
        '大二': [
            ['財政學（一）', 6],
            ['個體經濟學', 4],
            ['總體經濟學', 4],
            ['中級會計學', 6],
            ['貨幣銀行學', 4],
            ['商事法', 3]
        ],
        '大三': [
            ['所得稅理論與制度', 4],
            ['消費稅理論與制度', 2],
            ['財產稅理論與制度', 2],
            ['租稅法', 6]
        ],
        '大四': []
    },
    '企業管理學系': {
        '大一': [
            ['電腦概論與程式設計', 4],
            ['企業概論', 3],
            ['管理學', 3]
        ],
        '大二': [
            ['組織理論與行為', 3],
            ['財務管理', 3],
            ['行銷管理', 3],
            ['投資學', 3],
            ['作業管理', 3],
            ['作業研究', 3]
        ],
        '大三': [
            ['商業分析', 3],
            ['人力資源管理', 3],
            ['資訊管理', 3],
            ['企業倫理', 2]
        ],
        '大四': [
            ['策略管理', 3],
            ['管理實務專題研討', 3]
        ]
    }
};

const EVALUATION_GRADE_ORDER = ['大一', '大二', '大三', '大四'];
const EVALUATION_DEMAND_TYPES = [
    { key: 'elective', label: '選修' },
    { key: 'general', label: '通識' },
    { key: 'support', label: '支援外系' },
    { key: 'flexible', label: '彈性調整' }
];

const evaluationState = {
    initialized: false,
    lastDepartment: '',
    courseRows: {
        required: {},
        elective: [],
        general: [],
        support: [],
        flexible: []
    }
};

function evaluationEscape(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function evaluationNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function evaluationInputNumber(value, options = {}) {
    const min = options.min ?? 0;
    const step = options.step ?? '1';
    const placeholder = options.placeholder ?? '';
    return `<input type="number" min="${min}" step="${step}" value="${value ?? ''}" placeholder="${placeholder}" onchange="evaluationRecalculate()" oninput="evaluationRecalculate()" class="evaluation-number-input w-full rounded-lg border-gray-300 text-sm focus:border-ntpuBlue focus:ring-ntpuBlue">`;
}

function evaluationGetAffairs() {
    if (typeof analysisState === 'undefined') return [];
    return Array.isArray(analysisState.data?.affairs) ? analysisState.data.affairs : [];
}

function evaluationUnique(values) {
    return [...new Set(values.filter(v => v !== undefined && v !== null && String(v).trim() !== ''))];
}

function evaluationInitSelectors() {
    const college = document.getElementById('evaluation-college');
    const department = document.getElementById('evaluation-department');
    if (!college || !department) return;

    const affairs = evaluationGetAffairs();
    const colleges = evaluationUnique(affairs.map(r => r.學院));
    const departments = evaluationUnique(affairs.map(r => r.系所));

    if (!colleges.length || !departments.length) {
        college.innerHTML = '<option value="">資料載入中……</option>';
        department.innerHTML = '<option value="">資料載入中……</option>';
        setTimeout(evaluationInitSelectors, 300);
        return;
    }

    const currentCollege = college.value;
    const currentDepartment = department.value;

    college.innerHTML = '<option value="">請選擇學院</option>' + colleges.map(v => `<option value="${evaluationEscape(v)}">${evaluationEscape(v)}</option>`).join('');
    if (colleges.includes(currentCollege)) college.value = currentCollege;

    evaluationUpdateDepartments(currentDepartment);
}

function evaluationUpdateDepartments(preferredDepartment = '') {
    const college = document.getElementById('evaluation-college');
    const department = document.getElementById('evaluation-department');
    if (!college || !department) return;

    const affairs = evaluationGetAffairs();
    let departments = affairs
        .filter(r => !college.value || r.學院 === college.value)
        .map(r => r.系所);
    departments = evaluationUnique(departments).sort((a, b) => String(a).localeCompare(String(b), 'zh-Hant'));

    department.innerHTML = '<option value="">請選擇系所</option>' + departments.map(v => `<option value="${evaluationEscape(v)}">${evaluationEscape(v)}</option>`).join('');
    if (preferredDepartment && departments.includes(preferredDepartment)) {
        department.value = preferredDepartment;
    }

    evaluationDepartmentChanged(false);
}

function evaluationCollegeChanged() {
    evaluationUpdateDepartments('');
}

function evaluationDepartmentChanged(shouldReset = true) {
    const department = document.getElementById('evaluation-department')?.value || '';
    const changed = department !== evaluationState.lastDepartment;

    if (shouldReset && !changed) return;
    if (changed || shouldReset) {
        evaluationState.lastDepartment = department;
        evaluationLoadRequiredDefaults(department);
    }
    evaluationRecalculate();
}

function evaluationLoadRequiredDefaults(department) {
    const container = document.getElementById('evaluation-required-groups');
    if (!container) return;

    const defaults = EVALUATION_DEFAULT_REQUIRED_COURSES[department];
    evaluationState.courseRows.required = {};

    container.innerHTML = EVALUATION_GRADE_ORDER.map(grade => {
        const rows = defaults?.[grade] || [];
        evaluationState.courseRows.required[grade] = rows.map(([name, credits]) => ({
            id: evaluationMakeId(),
            name,
            credits,
            sections: ''
        }));
        return evaluationRenderRequiredGrade(grade);
    }).join('');

    if (!defaults) {
        container.insertAdjacentHTML('afterbegin', '<div class="mb-4 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800"><i class="fa-solid fa-circle-info mr-2"></i>目前沒有此系所的預設必修課程，請依實際需求自行新增。</div>');
    }
}

function evaluationMakeId() {
    return `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function evaluationRenderRequiredGrade(grade) {
    const rows = evaluationState.courseRows.required[grade] || [];
    return `
        <div class="evaluation-grade-group bg-gray-50/70 border border-gray-200 rounded-xl overflow-hidden mb-4" data-grade="${grade}">
            <div class="px-4 py-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                <h4 class="font-black text-sm text-ntpuDark">${grade}</h4>
                <button type="button" onclick="evaluationAddRequiredRow('${grade}')" class="text-xs font-bold text-ntpuBlue hover:text-blue-800">
                    <i class="fa-solid fa-plus mr-1"></i>新增課程
                </button>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                    <thead class="bg-white text-xs text-gray-500">
                        <tr>
                            <th class="text-left px-4 py-2 min-w-[260px]">課程名稱</th>
                            <th class="text-left px-4 py-2 w-28">學分</th>
                            <th class="text-left px-4 py-2 w-32">開課總門數</th>
                            <th class="text-right px-4 py-2 w-32">總學分</th>
                            <th class="w-12"></th>
                        </tr>
                    </thead>
                    <tbody>${rows.map(row => evaluationRenderRequiredRow(row)).join('')}</tbody>
                </table>
            </div>
            <div class="px-4 py-3 bg-white border-t border-gray-200 text-right text-sm font-bold text-gray-700">
                ${grade}小計：<span id="evaluation-required-total-${evaluationSafeId(grade)}" class="text-ntpuBlue">0</span> 學分
            </div>
        </div>`;
}

function evaluationSafeId(value) {
    return String(value).replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-');
}

function evaluationRenderRequiredRow(row) {
    return `<tr data-row-id="${row.id}" class="border-t border-gray-100 bg-white">
        <td class="px-4 py-2"><input type="text" value="${evaluationEscape(row.name)}" oninput="evaluationRequiredTextChanged(this, '${row.id}')" class="w-full rounded-lg border-gray-300 text-sm focus:border-ntpuBlue focus:ring-ntpuBlue" placeholder="課程名稱"></td>
        <td class="px-4 py-2"><input type="number" min="0" step="0.5" value="${row.credits ?? ''}" oninput="evaluationRequiredValueChanged(this, '${row.id}', 'credits')" class="w-full rounded-lg border-gray-300 text-sm"></td>
        <td class="px-4 py-2"><input type="number" min="0" step="1" value="${row.sections ?? ''}" oninput="evaluationRequiredValueChanged(this, '${row.id}', 'sections')" class="w-full rounded-lg border-gray-300 text-sm" placeholder="請填寫"></td>
        <td class="px-4 py-2 text-right font-semibold text-gray-700"><span class="evaluation-required-row-total">0</span></td>
        <td class="px-4 py-2 text-right"><button type="button" onclick="evaluationRemoveRequiredRow('${row.grade || ''}', '${row.id}')" class="text-gray-400 hover:text-red-500" title="刪除課程"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`;
}

function evaluationRequiredTextChanged(input, id) {
    for (const grade of EVALUATION_GRADE_ORDER) {
        const row = (evaluationState.courseRows.required[grade] || []).find(r => r.id === id);
        if (row) row.name = input.value;
    }
    evaluationRecalculate();
}

function evaluationRequiredValueChanged(input, id, field) {
    for (const grade of EVALUATION_GRADE_ORDER) {
        const row = (evaluationState.courseRows.required[grade] || []).find(r => r.id === id);
        if (row) row[field] = input.value;
    }
    evaluationRecalculate();
}

function evaluationAddRequiredRow(grade) {
    if (!evaluationState.courseRows.required[grade]) evaluationState.courseRows.required[grade] = [];
    evaluationState.courseRows.required[grade].push({ id: evaluationMakeId(), name: '', credits: '', sections: '' });
    evaluationRefreshRequiredGrade(grade);
}

function evaluationRemoveRequiredRow(grade, id) {
    if (!grade) {
        const rowEl = document.querySelector(`[data-row-id="${CSS.escape(id)}"]`);
        const group = rowEl?.closest('[data-grade]');
        grade = group?.dataset.grade || '';
    }
    if (!grade) return;
    evaluationState.courseRows.required[grade] = (evaluationState.courseRows.required[grade] || []).filter(r => r.id !== id);
    evaluationRefreshRequiredGrade(grade);
}

function evaluationRefreshRequiredGrade(grade) {
    const group = document.querySelector(`[data-grade="${CSS.escape(grade)}"]`);
    if (!group) return;
    const replacement = document.createElement('div');
    replacement.innerHTML = evaluationRenderRequiredGrade(grade);
    group.replaceWith(replacement.firstElementChild);
    evaluationRecalculate();
}

function evaluationRenderDemandSection(type, label) {
    const rows = evaluationState.courseRows[type] || [];
    return `
        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden" data-demand-type="${type}">
            <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div>
                    <h4 class="font-black text-base text-ntpuDark">${label}</h4>
                    <p class="text-xs text-gray-500 mt-0.5">可逐堂填寫課程名稱與學分；共幾學分會自動加總。</p>
                </div>
                <button type="button" onclick="evaluationAddDemandRow('${type}')" class="inline-flex items-center px-3 py-2 rounded-lg bg-ntpuBlue text-white text-xs font-bold hover:bg-blue-800">
                    <i class="fa-solid fa-plus mr-1"></i>新增課程
                </button>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                    <thead class="bg-white text-xs text-gray-500">
                        <tr><th class="text-left px-4 py-2 min-w-[280px]">課程名稱</th><th class="text-left px-4 py-2 w-32">學分</th><th class="w-12"></th></tr>
                    </thead>
                    <tbody id="evaluation-${type}-rows">${rows.map(row => evaluationRenderDemandRow(type, row)).join('')}</tbody>
                </table>
            </div>
            <div class="px-4 py-3 bg-gray-50 border-t border-gray-200 text-right text-sm font-bold">共幾學分：<span id="evaluation-${type}-total" class="text-ntpuBlue">0</span></div>
        </div>`;
}

function evaluationRenderDemandRow(type, row) {
    return `<tr class="border-t border-gray-100" data-demand-row-id="${row.id}">
        <td class="px-4 py-2"><input type="text" value="${evaluationEscape(row.name)}" oninput="evaluationDemandTextChanged('${type}', '${row.id}', this.value)" class="w-full rounded-lg border-gray-300 text-sm focus:border-ntpuBlue focus:ring-ntpuBlue" placeholder="課程名稱"></td>
        <td class="px-4 py-2"><input type="number" min="0" step="0.5" value="${row.credits ?? ''}" oninput="evaluationDemandCreditChanged('${type}', '${row.id}', this.value)" class="w-full rounded-lg border-gray-300 text-sm" placeholder="學分"></td>
        <td class="px-4 py-2 text-right"><button type="button" onclick="evaluationRemoveDemandRow('${type}', '${row.id}')" class="text-gray-400 hover:text-red-500" title="刪除課程"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`;
}

function evaluationAddDemandRow(type) {
    evaluationState.courseRows[type].push({ id: evaluationMakeId(), name: '', credits: '' });
    evaluationRefreshDemandRows(type);
}

function evaluationRemoveDemandRow(type, id) {
    evaluationState.courseRows[type] = evaluationState.courseRows[type].filter(row => row.id !== id);
    evaluationRefreshDemandRows(type);
}

function evaluationDemandTextChanged(type, id, value) {
    const row = evaluationState.courseRows[type].find(r => r.id === id);
    if (row) row.name = value;
    evaluationRecalculate();
}

function evaluationDemandCreditChanged(type, id, value) {
    const row = evaluationState.courseRows[type].find(r => r.id === id);
    if (row) row.credits = value;
    evaluationRecalculate();
}

function evaluationRefreshDemandRows(type) {
    const tbody = document.getElementById(`evaluation-${type}-rows`);
    if (!tbody) return;
    tbody.innerHTML = evaluationState.courseRows[type].map(row => evaluationRenderDemandRow(type, row)).join('');
    evaluationRecalculate();
}

function evaluationInitializeDemandSections() {
    EVALUATION_DEMAND_TYPES.forEach(({ key }) => {
        evaluationState.courseRows[key] = [];
        const host = document.getElementById(`evaluation-${key}-section`);
        if (host) host.innerHTML = evaluationRenderDemandSection(key, EVALUATION_DEMAND_TYPES.find(x => x.key === key).label);
    });
}

function evaluationReadNumber(id) {
    return evaluationNumber(document.getElementById(id)?.value);
}

function evaluationSelectedReduction() {
    return document.querySelector('input[name="evaluation-reduction"]:checked')?.value || 'none';
}

function evaluationTeachingHours() {
    const reduction = evaluationSelectedReduction();
    const base = { professor: 8, associate: 9, assistant: 9, lecturer: 10 };
    if (reduction === 'one') return { professor: 7, associate: 8, assistant: 8, lecturer: 9 };
    if (reduction === 'three') return { professor: 6, associate: 6, assistant: 6, lecturer: 7 };
    return base;
}

function evaluationCalculateSupply() {
    const hours = evaluationTeachingHours();
    const professor = evaluationReadNumber('evaluation-professor-count');
    const associate = evaluationReadNumber('evaluation-associate-count');
    const assistant = evaluationReadNumber('evaluation-assistant-count');
    const lecturer = evaluationReadNumber('evaluation-lecturer-count');
    const adjunct = evaluationReadNumber('evaluation-adjunct-count');
    const adjunctHours = evaluationReadNumber('evaluation-adjunct-hours');
    return {
        total: professor * hours.professor + associate * hours.associate + assistant * hours.assistant + lecturer * hours.lecturer + adjunct * adjunctHours,
        hours,
        counts: { professor, associate, assistant, lecturer, adjunct, adjunctHours }
    };
}

function evaluationCalculateRequired() {
    let total = 0;
    for (const grade of EVALUATION_GRADE_ORDER) {
        const rows = evaluationState.courseRows.required[grade] || [];
        const gradeTotal = rows.reduce((sum, row) => sum + evaluationNumber(row.credits) * evaluationNumber(row.sections), 0);
        total += gradeTotal;
        const el = document.getElementById(`evaluation-required-total-${evaluationSafeId(grade)}`);
        if (el) el.textContent = evaluationFormatNumber(gradeTotal);
        const group = document.querySelector(`[data-grade="${CSS.escape(grade)}"]`);
        if (group) {
            group.querySelectorAll('.evaluation-required-row-total').forEach(span => {
                const rowEl = span.closest('tr');
                const id = rowEl?.dataset.rowId;
                const row = rows.find(r => r.id === id);
                span.textContent = evaluationFormatNumber(evaluationNumber(row?.credits) * evaluationNumber(row?.sections));
            });
        }
    }
    return total;
}

function evaluationCalculateDemand(type) {
    const total = (evaluationState.courseRows[type] || []).reduce((sum, row) => sum + evaluationNumber(row.credits), 0);
    const el = document.getElementById(`evaluation-${type}-total`);
    if (el) el.textContent = evaluationFormatNumber(total);
    return total;
}

function evaluationFormatNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function evaluationRecalculate() {
    const supply = evaluationCalculateSupply();
    const required = evaluationCalculateRequired();
    const elective = evaluationCalculateDemand('elective');
    const general = evaluationCalculateDemand('general');
    const support = evaluationCalculateDemand('support');
    const flexible = evaluationCalculateDemand('flexible');
    const demand = required + elective + general + support + flexible;
    const difference = supply.total - demand;

    const supplyEl = document.getElementById('evaluation-total-supply');
    const demandEl = document.getElementById('evaluation-total-demand');
    const diffEl = document.getElementById('evaluation-difference');
    if (supplyEl) supplyEl.textContent = evaluationFormatNumber(supply.total);
    if (demandEl) demandEl.textContent = evaluationFormatNumber(demand);
    if (diffEl) {
        diffEl.textContent = `${difference > 0 ? '+' : ''}${evaluationFormatNumber(difference)}`;
        diffEl.className = `font-black ${difference < 0 ? 'text-red-600' : difference > 0 ? 'text-emerald-600' : 'text-gray-700'}`;
    }

    const result = document.getElementById('evaluation-result');
    const resultText = document.getElementById('evaluation-result-text');
    if (result && resultText) {
        result.classList.remove('hidden', 'bg-red-50', 'border-red-200', 'text-red-700', 'bg-emerald-50', 'border-emerald-200', 'text-emerald-700', 'bg-gray-50', 'border-gray-200', 'text-gray-700');
        if (difference > 0) {
            result.classList.add('bg-emerald-50', 'border-emerald-200', 'text-emerald-700');
            resultText.textContent = '可考慮減授';
        } else if (difference < 0) {
            result.classList.add('bg-red-50', 'border-red-200', 'text-red-700');
            resultText.textContent = '供給不足';
        } else {
            result.classList.add('bg-gray-50', 'border-gray-200', 'text-gray-700');
            resultText.textContent = '供需相符';
        }
    }

    evaluationRenderScenarioRows(supply);
}

function evaluationRenderScenarioRows(supply) {
    const body = document.getElementById('evaluation-scenario-body');
    if (!body) return;
    const h = supply.hours;
    const rows = [
        ['教授', supply.counts.professor, h.professor, supply.counts.professor * h.professor],
        ['副教授', supply.counts.associate, h.associate, supply.counts.associate * h.associate],
        ['助理教授', supply.counts.assistant, h.assistant, supply.counts.assistant * h.assistant],
        ['講師', supply.counts.lecturer, h.lecturer, supply.counts.lecturer * h.lecturer],
        ['兼任教師', supply.counts.adjunct, supply.counts.adjunctHours, supply.counts.adjunct * supply.counts.adjunctHours]
    ];
    body.innerHTML = rows.map(r => `<tr class="border-t border-gray-100"><td class="px-4 py-2 font-semibold">${r[0]}</td><td class="px-4 py-2 text-right">${evaluationFormatNumber(r[1])}</td><td class="px-4 py-2 text-right">${evaluationFormatNumber(r[2])}</td><td class="px-4 py-2 text-right font-semibold">${evaluationFormatNumber(r[3])}</td></tr>`).join('');
}

function evaluationValidate() {
    const name = document.getElementById('evaluation-name')?.value.trim() || '';
    const department = document.getElementById('evaluation-department')?.value || '';
    const errors = [];
    if (!department) errors.push('請選擇系所。');
    if (!name) errors.push('請填寫姓名。');

    const adjunctCount = evaluationReadNumber('evaluation-adjunct-count');
    const adjunctHoursRaw = document.getElementById('evaluation-adjunct-hours')?.value.trim() || '';
    if (adjunctCount > 0 && !adjunctHoursRaw) errors.push('已有兼任教師人數時，請填寫兼任教師每人授課時數。');

    document.querySelectorAll('#evaluation-required-groups input[type="number"]').forEach(input => {
        if (input.value !== '' && Number(input.value) < 0) errors.push('課程學分與開課門數不可為負數。');
    });
    document.querySelectorAll('#evaluation-required-groups tr[data-row-id]').forEach(row => {
        const nameInput = row.querySelector('input[type="text"]');
        const numbers = [...row.querySelectorAll('input[type="number"]')];
        const hasAny = nameInput?.value.trim() || numbers.some(i => i.value !== '');
        const hasName = nameInput?.value.trim();
        const hasCredit = numbers[0]?.value !== '';
        const hasSections = numbers[1]?.value !== '';
        if (hasAny && (!hasName || !hasCredit || !hasSections)) errors.push('必修課程若有填寫，課程名稱、學分與開課總門數請完整填寫。');
    });

    EVALUATION_DEMAND_TYPES.forEach(({ key }) => {
        document.querySelectorAll(`#evaluation-${key}-rows tr`).forEach(row => {
            const nameInput = row.querySelector('input[type="text"]');
            const creditInput = row.querySelector('input[type="number"]');
            const hasAny = nameInput?.value.trim() || creditInput?.value !== '';
            if (hasAny && (!nameInput?.value.trim() || creditInput?.value === '')) errors.push(`${EVALUATION_DEMAND_TYPES.find(x => x.key === key).label} 課程若有填寫，請完整填寫課程名稱與學分。`);
        });
    });

    if (errors.length) {
        alert([...new Set(errors)].join('\n'));
        return false;
    }
    return true;
}

function evaluationCollectPayload() {
    const supply = evaluationCalculateSupply();
    const required = evaluationCalculateRequired();
    const elective = evaluationCalculateDemand('elective');
    const general = evaluationCalculateDemand('general');
    const support = evaluationCalculateDemand('support');
    const flexible = evaluationCalculateDemand('flexible');
    const demand = required + elective + general + support + flexible;

    const requiredCourses = EVALUATION_GRADE_ORDER.flatMap(grade =>
        (evaluationState.courseRows.required[grade] || []).filter(r => r.name.trim() || r.credits !== '' || r.sections !== '').map(r => ({
            category: '必修', grade, courseName: r.name.trim(), credits: evaluationNumber(r.credits), sections: evaluationNumber(r.sections), totalCredits: evaluationNumber(r.credits) * evaluationNumber(r.sections)
        }))
    );
    const otherCourses = EVALUATION_DEMAND_TYPES.flatMap(({ key, label }) =>
        (evaluationState.courseRows[key] || []).filter(r => r.name.trim() || r.credits !== '').map(r => ({ category: label, grade: '', courseName: r.name.trim(), credits: evaluationNumber(r.credits), sections: '', totalCredits: evaluationNumber(r.credits) }))
    );

    return {
        submittedAt: new Date().toISOString(),
        academicYear: document.getElementById('evaluation-academic-year')?.value || '',
        college: document.getElementById('evaluation-college')?.value || '',
        department: document.getElementById('evaluation-department')?.value || '',
        name: document.getElementById('evaluation-name')?.value.trim() || '',
        reduction: evaluationSelectedReduction(),
        teacherCounts: supply.counts,
        teachingHoursAfterReduction: supply.hours,
        requiredTotalCredits: required,
        electiveTotalCredits: elective,
        generalTotalCredits: general,
        supportTotalCredits: support,
        flexibleTotalCredits: flexible,
        totalSupplyHours: supply.total,
        totalDemandHours: demand,
        difference: supply.total - demand,
        evaluation: supply.total > demand ? '可考慮減授' : supply.total < demand ? '供給不足' : '供需相符',
        courseDetails: [...requiredCourses, ...otherCourses]
    };
}

async function evaluationSubmit() {
    if (!evaluationValidate()) return;
    const button = document.getElementById('evaluation-submit-button');
    const status = document.getElementById('evaluation-submit-status');
    const payload = evaluationCollectPayload();

    if (!EVALUATION_GOOGLE_APPS_SCRIPT_URL) {
        if (status) {
            status.className = 'mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3';
            status.textContent = '目前尚未設定 Google Apps Script Web App 網址；分析功能可正常使用，但尚未啟用雲端提交。';
        }
        console.log('各系所減授評估 payload：', payload);
        return;
    }

    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>提交中……';
    }
    if (status) {
        status.className = 'mt-3 text-sm text-gray-500';
        status.textContent = '正在提交分析結果……';
    }

    try {
        const response = await fetch(EVALUATION_GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        if (status) {
            status.className = 'mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3';
            status.textContent = '分析結果已提交。';
        }
    } catch (error) {
        console.error(error);
        if (status) {
            status.className = 'mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3';
            status.textContent = '提交失敗，請確認網路連線或 Google Apps Script 設定。';
        }
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="fa-solid fa-paper-plane mr-2"></i>提交分析結果';
        }
    }
}

function evaluationReset() {
    document.getElementById('evaluation-name').value = '';
    document.getElementById('evaluation-professor-count').value = '';
    document.getElementById('evaluation-associate-count').value = '';
    document.getElementById('evaluation-assistant-count').value = '';
    document.getElementById('evaluation-lecturer-count').value = '';
    document.getElementById('evaluation-adjunct-count').value = '';
    document.getElementById('evaluation-adjunct-hours').value = '';
    document.querySelector('input[name="evaluation-reduction"][value="none"]').checked = true;
    evaluationState.lastDepartment = '';
    evaluationLoadRequiredDefaults(document.getElementById('evaluation-department')?.value || '');
    evaluationInitializeDemandSections();
    evaluationRecalculate();
}

function evaluationInit() {
    if (evaluationState.initialized) return;
    evaluationState.initialized = true;
    evaluationInitializeDemandSections();
    evaluationInitSelectors();
    evaluationLoadRequiredDefaults('');
    evaluationRecalculate();
}

window.addEventListener('DOMContentLoaded', evaluationInit);

// 若使用者先進入其他頁面，分析資料稍後才完成，切換到 page12 時再初始化一次。
const originalSwitchTabForEvaluation = window.switchTab;
window.switchTab = function(tabId) {
    if (typeof originalSwitchTabForEvaluation === 'function') originalSwitchTabForEvaluation(tabId);
    if (tabId === 'page12') {
        evaluationInit();
        evaluationInitSelectors();
        window.setTimeout(evaluationRecalculate, 50);
    }
};
