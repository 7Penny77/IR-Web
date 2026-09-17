/* 
 * 教師授課分析 - 第一版
 * A：全校比較
 * B/C 的資料載入與共用資料層先保留接口，後續擴充。
 */

const ANALYSIS_DATA_PATH = './data/';
const analysisState = {
    data: {
        affairs: [],
        teachtime: [],
        salary: [],
        graduate: [],
        course: []
    },
    loaded: false,
    filters: {
        years: null,       // null = 全部；[] = 不選任何項目
        colleges: null,
        departments: null
    },
    topic: 'teachtime',
    variable: '實際授課時數',
    stat: 'sum',
    unit: '時數',
    chartType: 'bar',
    axis: 'department',
    customNumerator: '',
    customDenominator: '',
    chart: null
};

const TOPICS = {
    teachtime: {
        label: '授課時數',
        units: ['時數'],
        variables: {
            '時數': [
                ['教師人數', '教師人數'],
                ['實際授課時數', '實際授課時數'],
                ['加權授課時數', '加權授課時數']
            ]
        }
    },
    graduate: {
        label: '學士班畢業學分',
        units: ['學分'],
        variables: {
            '學分': [
                ['系必修', '系必修'],
                ['院必修或外系開設列入系必修學分數', '院必修或外系開設列入系必修學分數'],
                ['系定選修', '系定選修'],
                ['通識共同必修', '通識共同必修'],
                ['其他（含自由選修）', '其他(含自由選修）'],
                ['總學分數', '總學分數']
            ]
        }
    },
    salary: {
        label: '教師鐘點費結構',
        units: ['時數'],
        variables: {
            '時數': [
                ['教師人數', '教師人數'],
                ['正課', '正課'],
                ['實習', '實習'],
                ['大班', '大班'],
                ['遠距', '遠距'],
                ['外語', '外語'],
                ['行政減授', '行政減授'],
                ['進修學士班折抵', '進修學士班折抵'],
                ['新進教師減授及返還', '新進教師減授及返還'],
                ['計畫類', '計畫類'],
                ['指導研究生', '指導研究生']
            ]
        }
    },
    course: {
        label: '114 開課現況',
        units: ['學分', '時數', '堂數'],
        variables: {
            '學分': [
                ['必修學分', '必修學分'],
                ['選修學分', '選修學分'],
                ['通識學分', '通識學分'],
                ['大一國文學分', '大一國文學分'],
                ['基礎學分', '基礎學分'],
                ['學分加總', '學分加總'],
                ['必修大班學分', '必修大班學分'],
                ['選修大班學分', '選修大班學分'],
                ['通識大班學分', '通識大班學分'],
                ['大一國文大班學分', '大一國文大班學分'],
                ['基礎大班學分', '基礎大班學分'],
                ['大班學分加總', '大班學分加總'],
                ['必修支援學分', '必修支援學分'],
                ['選修支援學分', '選修支援學分'],
                ['通識支援學分', '通識支援學分'],
                ['大一國文支援學分', '大一國文支援學分'],
                ['基礎支援學分', '基礎支援學分'],
                ['支援學分加總', '支援學分加總']
            ],
            '時數': [
                ['必修時數', '必修時數'],
                ['選修時數', '選修時數'],
                ['通識時數', '通識時數'],
                ['大一國文時數', '大一國文時數'],
                ['基礎時數', '基礎時數'],
                ['時數加總', '時數加總'],
                ['必修大班時數', '必修大班時數'],
                ['選修大班時數', '選修大班時數'],
                ['通識大班時數', '通識大班時數'],
                ['大一國文大班時數', '大一國文大班時數'],
                ['基礎大班時數', '基礎大班時數'],
                ['大班時數加總', '大班時數加總'],
                ['必修支援時數', '必修支援時數'],
                ['選修支援時數', '選修支援時數'],
                ['通識支援時數', '通識支援時數'],
                ['大一國文支援時數', '大一國文支援時數'],
                ['基礎支援時數', '基礎支援時數'],
                ['支援時數加總', '支援時數加總']
            ],
            '堂數': [
                ['必修堂數', '必修堂數'],
                ['選修堂數', '選修堂數'],
                ['通識堂數', '通識堂數'],
                ['大一國文堂數', '大一國文堂數'],
                ['基礎堂數', '基礎堂數'],
                ['堂數加總', '堂數加總'],
                ['必修大班堂數', '必修大班堂數'],
                ['選修大班堂數', '選修大班堂數'],
                ['通識大班堂數', '通識大班堂數'],
                ['大一國文大班堂數', '大一國文大班堂數'],
                ['基礎大班堂數', '基礎大班堂數'],
                ['大班堂數加總', '大班堂數加總'],
                ['必修支援堂數', '必修支援堂數'],
                ['選修支援堂數', '選修支援堂數'],
                ['通識支援堂數', '通識支援堂數'],
                ['大一國文支援堂數', '大一國文支援堂數'],
                ['基礎支援堂數', '基礎支援堂數'],
                ['支援堂數加總', '支援堂數加總']
            ]
        }
    }
};

function analysisUnique(values) {
    return [...new Set(values.filter(v => v !== undefined && v !== null && v !== ''))];
}

function analysisNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function analysisFieldLabel(topic, field) {
    const unitMap = TOPICS[topic]?.variables || {};
    for (const unit of Object.keys(unitMap)) {
        const hit = unitMap[unit].find(x => x[1] === field);
        if (hit) return hit[0];
    }
    return field;
}

function analysisCollegeMap() {
    const map = {};
    analysisState.data.affairs.forEach(row => {
        if (row.系所 && row.學院) map[row.系所] = row.學院;
    });
    return map;
}

/*
 * 統一以 affairs.json 的「系所 → 學院」作為篩選用學院分類。
 * 這樣即使不同 JSON 的學院文字不同（例如「公院」與「公共事務學院」），
 * 前端仍使用同一套學院篩選。
 */
function analysisNormalizeRows(topic) {
    const rows = analysisState.data[topic] || [];
    const collegeMap = analysisCollegeMap();

    return rows.map(row => {
        // graduate.json 目前仍可能使用「單位」欄位；前端統一轉成「系所」。
        // 其他資料集則直接使用「系所」。
        const department = row.系所 || row.單位 || '';
        const normalized = {
            ...row,
            系所: department,
            __college: collegeMap[department] || row.學院 || '',
            // course.json 是 114 開課現況，原始資料沒有年度欄位，因此統一標記為 114。
            __year: topic === 'course' ? 114 : Number(row.年度)
        };

        return normalized;
    });
}

async function loadAnalysisData() {
    if (analysisState.loaded) return;

    const files = {
        affairs: 'affairs.json',
        teachtime: 'teachtime.json',
        salary: 'salary.json',
        graduate: 'graduate.json',
        course: 'course.json'
    };

    try {
        const entries = await Promise.all(
            Object.entries(files).map(async ([key, file]) => {
                const response = await fetch(`${ANALYSIS_DATA_PATH}${file}`);
                if (!response.ok) throw new Error(`${file} 載入失敗：${response.status}`);
                return [key, await response.json()];
            })
        );

        entries.forEach(([key, value]) => {
            analysisState.data[key] = Array.isArray(value) ? value : [];
        });

        analysisState.loaded = true;
        populateAnalysisFilters();
        renderAnalysisControls();
        updateAnalysis();
    } catch (error) {
        console.error(error);
        const status = document.getElementById('analysis-load-status');
        if (status) {
            status.textContent = `資料載入失敗：${error.message}`;
            status.className = 'text-sm text-red-600';
        }
    }
}

function populateAnalysisFilters() {
    const allRows = [
        ...analysisNormalizeRows('teachtime'),
        ...analysisNormalizeRows('salary'),
        ...analysisNormalizeRows('graduate'),
        ...analysisNormalizeRows('course')
    ];

    const years = analysisUnique(allRows.map(r => r.__year)).sort((a, b) => b - a);
    const colleges = analysisUnique(analysisState.data.affairs.map(r => r.學院));
    const departments = analysisUnique(analysisState.data.affairs.map(r => r.系所));

    analysisState.filters.years = years;
    analysisState.filters.colleges = colleges;
    analysisState.filters.departments = departments;

    renderCheckboxGroup('analysis-year-options', years, 'year', years || []);
    renderCheckboxGroup('analysis-college-options', colleges, 'college', colleges || []);
    updateDepartmentFilter();
    updateFilterSummary();
}

function renderCheckboxGroup(containerId, values, type, selectedValues) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = values.map(value => {
        const checked = selectedValues.includes(value) ? 'checked' : '';
        const id = `analysis-${type}-${String(value).replace(/[^\w\u4e00-\u9fff-]/g, '_')}`;
        return `
            <label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm">
                <input type="checkbox" value="${escapeHtml(String(value))}" ${checked}
                       class="analysis-filter-${type} accent-[var(--ntpu-blue)]"
                       onchange="analysisFilterChanged('${type}')">
                <span>${escapeHtml(String(value))}</span>
            </label>`;
    }).join('');
}

function getCheckedValues(className) {
    return [...document.querySelectorAll(`.${className}:checked`)].map(el => {
        const value = el.value;
        return /^\d+$/.test(value) ? Number(value) : value;
    });
}

function analysisFilterChanged(type) {
    if (type === 'year') analysisState.filters.years = getCheckedValues('analysis-filter-year');
    if (type === 'college') analysisState.filters.colleges = getCheckedValues('analysis-filter-college');
    if (type === 'department') analysisState.filters.departments = getCheckedValues('analysis-filter-department');

    if (type === 'college') updateDepartmentFilter();

    updateFilterSummary();
    updateAnalysis();
}

function updateDepartmentFilter() {
    const selectedColleges = analysisState.filters.colleges;
    const allDepartments = analysisState.data.affairs
        .filter(r => selectedColleges === null || selectedColleges.includes(r.學院))
        .map(r => r.系所);

    const departments = analysisUnique(allDepartments);

    if (analysisState.filters.departments === null) {
        analysisState.filters.departments = departments;
    } else {
        analysisState.filters.departments =
            analysisState.filters.departments.filter(d => departments.includes(d));
    }

    renderCheckboxGroup(
        'analysis-department-options',
        departments,
        'department',
        analysisState.filters.departments || []
    );
    const count = document.getElementById('analysis-department-count');
    if (count) count.textContent = `已選 ${analysisState.filters.departments.length} 個系所`;
}

function selectAllAnalysisFilters(type, selectAll = true) {
    if (type === 'year') {
        analysisState.filters.years = selectAll
            ? analysisUnique(analysisState.data.teachtime.map(r => Number(r.年度))).sort((a,b) => b-a)
            : [];
        renderCheckboxGroup('analysis-year-options',
            analysisUnique(analysisState.data.teachtime.map(r => Number(r.年度))).sort((a,b) => b-a),
            'year', analysisState.filters.years);
    }

    if (type === 'college') {
        analysisState.filters.colleges = selectAll
            ? analysisUnique(analysisState.data.affairs.map(r => r.學院))
            : [];
        renderCheckboxGroup('analysis-college-options',
            analysisUnique(analysisState.data.affairs.map(r => r.學院)),
            'college', analysisState.filters.colleges);
        updateDepartmentFilter();
    }

    if (type === 'department') {
        const available = analysisState.data.affairs
            .filter(r => analysisState.filters.colleges === null || analysisState.filters.colleges.includes(r.學院))
            .map(r => r.系所);
        analysisState.filters.departments = selectAll ? analysisUnique(available) : [];
        renderCheckboxGroup('analysis-department-options',
            analysisUnique(available), 'department', analysisState.filters.departments);
    }

    updateFilterSummary();
    updateAnalysis();
}

function updateFilterSummary() {
    const el = document.getElementById('analysis-filter-summary');
    if (!el) return;

    const allYears = analysisUnique(analysisState.data.teachtime.map(r => Number(r.年度)));
    const allColleges = analysisUnique(analysisState.data.affairs.map(r => r.學院));
    const allDepartments = analysisUnique(analysisState.data.affairs.map(r => r.系所));

    const label = (selected, all, unit) => {
        if (selected === null) return `全部${unit}`;
        if (selected.length === 0) return `0 ${unit}`;
        if (selected.length === all.length) return `全部${unit}`;
        return `${selected.length} ${unit}`;
    };

    el.textContent = `${label(analysisState.filters.years, allYears, '年度')}・${label(analysisState.filters.colleges, allColleges, '學院')}・${label(analysisState.filters.departments, allDepartments, '系所')}`;
}

function renderAnalysisControls() {
    const topicSelect = document.getElementById('analysis-topic');
    if (!topicSelect) return;

    topicSelect.innerHTML = Object.entries(TOPICS).map(([key, topic]) =>
        `<option value="${key}">${topic.label}</option>`
    ).join('');
    topicSelect.value = analysisState.topic;

    updateVariableOptions();
    updateStatOptions();
    updateUnitOptions();
    updateAxisOptions();
    updateCustomOptions();
}

function updateVariableOptions() {
    const select = document.getElementById('analysis-variable');
    if (!select) return;

    const topic = TOPICS[analysisState.topic];
    const variables = topic.variables[analysisState.unit] || [];

    select.innerHTML = variables.map(([label, field]) =>
        `<option value="${escapeHtml(field)}">${escapeHtml(label)}</option>`
    ).join('');

    if (!variables.some(v => v[1] === analysisState.variable)) {
        analysisState.variable = variables[0]?.[1] || '';
    }
    select.value = analysisState.variable;
}

function updateStatOptions() {
    const select = document.getElementById('analysis-stat');
    if (!select) return;

    const options = [
        ['sum', '加總'],
        ['average', '平均'],
        ['share', '占比'],
        ['custom', '自定義']
    ];

    select.innerHTML = options.map(([value, label]) =>
        `<option value="${value}">${label}</option>`
    ).join('');
    select.value = analysisState.stat;
}

function updateUnitOptions() {
    const select = document.getElementById('analysis-unit');
    if (!select) return;

    const units = TOPICS[analysisState.topic].units;
    select.innerHTML = units.map(unit => `<option value="${escapeHtml(unit)}">${escapeHtml(unit)}</option>`).join('');

    if (!units.includes(analysisState.unit)) analysisState.unit = units[0];
    select.value = analysisState.unit;
}

function updateAxisOptions() {
    const select = document.getElementById('analysis-axis');
    if (!select) return;
    select.innerHTML = `
        <option value="department">系所</option>
        <option value="year">年度</option>
    `;
    select.value = analysisState.axis;
}

function updateCustomOptions() {
    const num = document.getElementById('analysis-custom-numerator');
    const den = document.getElementById('analysis-custom-denominator');
    if (!num || !den) return;

    const topic = TOPICS[analysisState.topic];
    let fields = analysisUnique((topic.variables[analysisState.unit] || []).map(v => v[1]));

    // 自定義保留常用分母：教師人數；salary 另外保留鐘點時數。
    if (analysisState.topic === 'teachtime' || analysisState.topic === 'salary' || analysisState.topic === 'course') {
        fields = analysisUnique([...fields, '教師人數']);
    }
    if (analysisState.topic === 'salary') fields = analysisUnique([...fields, '鐘點時數']);

    const options = fields.map(field =>
        `<option value="${escapeHtml(field)}">${escapeHtml(analysisFieldLabel(analysisState.topic, field))}</option>`
    ).join('');

    num.innerHTML = options;
    den.innerHTML = options;

    if (!fields.includes(analysisState.customNumerator)) analysisState.customNumerator = fields[0] || '';
    if (!fields.includes(analysisState.customDenominator)) {
        const preferred = analysisState.topic === 'course'
            ? (analysisState.unit === '學分' ? '學分加總' : analysisState.unit === '時數' ? '時數加總' : '堂數加總')
            : analysisState.topic === 'salary'
                ? '鐘點時數'
                : fields.find(f => f === '總學分數') || fields.find(f => f.includes('加總')) || fields[0] || '';
        analysisState.customDenominator = preferred;
    }

    num.value = analysisState.customNumerator;
    den.value = analysisState.customDenominator;
}

function analysisTopicChanged() {
    analysisState.topic = document.getElementById('analysis-topic').value;

    const units = TOPICS[analysisState.topic].units;
    analysisState.unit = units[0];

    updateUnitOptions();
    updateVariableOptions();
    updateStatOptions();
    updateCustomOptions();
    updateAnalysis();
}

function analysisUnitChanged() {
    analysisState.unit = document.getElementById('analysis-unit').value;
    updateVariableOptions();
    updateCustomOptions();
    updateAnalysis();
}

function analysisVariableChanged() {
    analysisState.variable = document.getElementById('analysis-variable').value;
    updateAnalysis();
}

function analysisStatChanged() {
    analysisState.stat = document.getElementById('analysis-stat').value;
    const customBox = document.getElementById('analysis-custom-box');
    if (customBox) customBox.classList.toggle('hidden', analysisState.stat !== 'custom');
    updateAnalysis();
}

function analysisCustomChanged() {
    analysisState.customNumerator = document.getElementById('analysis-custom-numerator').value;
    analysisState.customDenominator = document.getElementById('analysis-custom-denominator').value;
    updateAnalysis();
}

function analysisChartTypeChanged() {
    analysisState.chartType = document.getElementById('analysis-chart-type').value;
    updateAnalysis();
}

function analysisAxisChanged() {
    analysisState.axis = document.getElementById('analysis-axis').value;
    updateAnalysis();
}

function getFilteredRows(topic) {
    const rows = analysisNormalizeRows(topic);
    const { years, colleges, departments } = analysisState.filters;

    return rows.filter(row => {
        const yearOK = years === null || years.includes(row.__year);
        const collegeOK = colleges === null || colleges.includes(row.__college);
        const departmentOK = departments === null || departments.includes(row.系所);
        return yearOK && collegeOK && departmentOK;
    });
}

function findDenominatorField(topic, unit) {
    if (topic === 'course') {
        return unit === '學分' ? '學分加總' : unit === '時數' ? '時數加總' : '堂數加總';
    }
    if (topic === 'graduate') return '總學分數';
    if (topic === 'teachtime') return null;
    if (topic === 'salary') return '鐘點時數';
    return null;
}

const SALARY_SHARE_FIELDS = [
    '正課', '實習', '大班', '遠距', '外語',
    '行政減授', '進修學士班折抵', '新進教師減授及返還',
    '計畫類', '指導研究生'
];

function aggregateRows(rows, field, stat, topic, unit) {
    const groups = new Map();

    rows.forEach(row => {
        const key = `${row.__year}|||${row.系所}`;
        if (!groups.has(key)) {
            groups.set(key, {
                年度: row.__year,
                系所: row.系所,
                學院: row.__college,
                valueRows: []
            });
        }
        groups.get(key).valueRows.push(row);
    });

    return [...groups.values()].map(group => {
        const sourceRows = group.valueRows;
        const sum = sourceRows.reduce((acc, row) => acc + analysisNumber(row[field]), 0);

        let value = sum;
        let denominator = null;

        if (stat === 'average') {
            denominator = sourceRows.reduce((acc, row) => acc + analysisNumber(row['教師人數']), 0);
            value = denominator ? sum / denominator : null;
        } else if (stat === 'share') {
            const denominatorField = findDenominatorField(topic, unit);
            if (topic === 'teachtime') {
                // 授課時數的占比：以同一年度、目前篩選範圍內的該變數總量為分母。
                denominator = rows
                    .filter(row => row.__year === group.年度)
                    .reduce((acc, row) => acc + analysisNumber(row[field]), 0);
            } else if (topic === 'salary') {
                denominator = sourceRows.reduce((acc, row) =>
                    acc + SALARY_SHARE_FIELDS.reduce((inner, f) => inner + analysisNumber(row[f]), 0), 0);
            } else {
                denominator = sourceRows.reduce((acc, row) => acc + analysisNumber(row[denominatorField]), 0);
            }
            value = denominator ? (sum / denominator) * 100 : null;
        } else if (stat === 'custom') {
            const numerator = analysisState.customNumerator;
            const denominatorField = analysisState.customDenominator;
            const numeratorSum = sourceRows.reduce((acc, row) => acc + analysisNumber(row[numerator]), 0);
            const denominatorSum = sourceRows.reduce((acc, row) => acc + analysisNumber(row[denominatorField]), 0);
            denominator = denominatorSum;
            value = denominatorSum ? (numeratorSum / denominatorSum) * 100 : null;
        }

        return {
            年度: group.年度,
            系所: group.系所,
            學院: group.學院,
            value,
            denominator
        };
    }).filter(row => row.value !== null && Number.isFinite(row.value));
}

function buildChartModel(rows) {
    const axis = analysisState.axis;
    const categories = analysisUnique(rows.map(r => axis === 'year' ? r.年度 : r.系所))
        .sort((a, b) => {
            if (axis === 'year') return Number(a) - Number(b);
            return String(a).localeCompare(String(b), 'zh-Hant');
        });

    const groups = axis === 'year'
        ? analysisUnique(rows.map(r => r.系所))
        : analysisUnique(rows.map(r => r.年度)).sort((a, b) => Number(a) - Number(b));

    const datasets = groups.map(group => {
        const data = categories.map(category => {
            const row = rows.find(r =>
                (axis === 'year' ? r.年度 === category && r.系所 === group : r.系所 === category && r.年度 === group)
            );
            return row ? row.value : null;
        });

        return {
            label: String(group),
            data
        };
    });

    return { categories, datasets };
}

function analysisUnitSuffix() {
    if (analysisState.stat === 'share' || analysisState.stat === 'custom') return '%';
    if (analysisState.topic === 'teachtime' || analysisState.topic === 'salary') return ' 小時';
    if (analysisState.unit === '學分') return ' 學分';
    if (analysisState.unit === '時數') return ' 小時';
    if (analysisState.unit === '堂數') return ' 堂';
    return '';
}

function formatAnalysisValue(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    const digits = Math.abs(value % 1) < 0.000001 ? 0 : 2;
    return `${Number(value).toLocaleString('zh-TW', {
        minimumFractionDigits: digits,
        maximumFractionDigits: 4
    })}${analysisUnitSuffix()}`;
}

function analysisTitle() {
    const topic = TOPICS[analysisState.topic].label;
    if (analysisState.stat === 'custom') {
        return `${topic}｜${analysisFieldLabel(analysisState.topic, analysisState.customNumerator)} ÷ ${analysisFieldLabel(analysisState.topic, analysisState.customDenominator)}`;
    }
    return `${topic}｜${analysisFieldLabel(analysisState.topic, analysisState.variable)}｜${{
        sum: '加總',
        average: '平均',
        share: '占比'
    }[analysisState.stat]}`;
}

function updateChart(rows) {
    const canvas = document.getElementById('analysis-chart');
    const empty = document.getElementById('analysis-chart-empty');
    if (!canvas || !window.Chart) return;

    const model = buildChartModel(rows);

    if (analysisState.chart) {
        analysisState.chart.destroy();
        analysisState.chart = null;
    }

    if (!model.categories.length) {
        canvas.classList.add('hidden');
        empty?.classList.remove('hidden');
        return;
    }

    canvas.classList.remove('hidden');
    empty?.classList.add('hidden');

    const isHorizontal = analysisState.chartType === 'horizontalBar';
    const type = analysisState.chartType === 'line' ? 'line' : 'bar';

    analysisState.chart = new Chart(canvas.getContext('2d'), {
        type,
        data: {
            labels: model.categories.map(String),
            datasets: model.datasets.map(dataset => ({
                ...dataset,
                borderWidth: 2,
                tension: 0.25,
                fill: false,
                maxBarThickness: 42
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: isHorizontal ? 'y' : 'x',
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: model.datasets.length > 1,
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: context => `${context.dataset.label}: ${formatAnalysisValue(context.parsed.y ?? context.parsed.x)}`
                    }
                }
            },
            scales: {
                x: {
                    stacked: false,
                    title: {
                        display: true,
                        text: isHorizontal ? '數值' : (analysisState.axis === 'year' ? '年度' : '系所')
                    }
                },
                y: {
                    stacked: false,
                    title: {
                        display: true,
                        text: isHorizontal ? (analysisState.axis === 'year' ? '年度' : '系所') : '數值'
                    }
                }
            },
            onClick: (_, elements) => {
                if (!elements.length || analysisState.axis !== 'department') return;
                const index = elements[0].index;
                const department = model.categories[index];
                if (department) openDepartmentAnalysis(department);
            }
        }
    });

    const wrapper = document.getElementById('analysis-chart-wrapper');
    if (wrapper) {
        const height = isHorizontal
            ? Math.max(420, model.categories.length * 34)
            : 520;
        wrapper.style.height = `${height}px`;
    }
}

function updateAnalysisTable(rows) {
    const head = document.getElementById('analysis-table-head');
    const body = document.getElementById('analysis-table-body');
    if (!head || !body) return;

    head.innerHTML = `
        <tr>
            <th class="px-4 py-3">年度</th>
            <th class="px-4 py-3">學院</th>
            <th class="px-4 py-3">系所</th>
            <th class="px-4 py-3 text-right">${escapeHtml(analysisState.stat === 'custom' ? '分析值' : analysisFieldLabel(analysisState.topic, analysisState.variable))}</th>
        </tr>`;

    const sorted = [...rows].sort((a, b) =>
        Number(a.年度) - Number(b.年度) ||
        String(a.系所).localeCompare(String(b.系所), 'zh-Hant')
    );

    body.innerHTML = sorted.map(row => `
        <tr class="border-t border-gray-100 hover:bg-gray-50">
            <td class="px-4 py-3">${escapeHtml(String(row.年度))}</td>
            <td class="px-4 py-3">${escapeHtml(String(row.學院 || ''))}</td>
            <td class="px-4 py-3">
                <button type="button" class="text-ntpuBlue hover:text-blue-800 hover:underline font-semibold"
                        onclick="openDepartmentAnalysis(${JSON.stringify(row.系所)})">
                    ${escapeHtml(String(row.系所))}
                </button>
            </td>
            <td class="px-4 py-3 text-right font-medium">${formatAnalysisValue(row.value)}</td>
        </tr>
    `).join('');

    const count = document.getElementById('analysis-table-count');
    if (count) count.textContent = `共 ${sorted.length} 筆`;
}

function updateAnalysisMeta(rows) {
    const title = document.getElementById('analysis-chart-title');
    const desc = document.getElementById('analysis-chart-description');

    if (title) title.textContent = analysisTitle();

    if (desc) {
        const statText = analysisState.stat === 'sum'
            ? '加總'
            : analysisState.stat === 'average'
                ? '以教師人數為分母計算平均'
                : analysisState.stat === 'share'
                    ? '以同一單位的總量計算占比'
                    : '依使用者設定的分子與分母計算比例';

        desc.textContent = `${statText}｜目前 ${rows.length} 筆年度 × 系所資料`;
    }
}

function updateAnalysis() {
    if (!analysisState.loaded) return;

    const rows = getFilteredRows(analysisState.topic);

    const resultRows = aggregateRows(
        rows,
        analysisState.stat === 'custom' ? analysisState.customNumerator : analysisState.variable,
        analysisState.stat,
        analysisState.topic,
        analysisState.unit
    );

    updateAnalysisMeta(resultRows);
    updateChart(resultRows);
    updateAnalysisTable(resultRows);

    const status = document.getElementById('analysis-load-status');
    if (status) {
        status.textContent = `資料已載入：${analysisState.topic}｜目前顯示 ${resultRows.length} 筆分析資料`;
        status.className = 'text-sm text-gray-500';
    }
}

function downloadAnalysisCSV() {
    const rows = getFilteredRows(analysisState.topic);
    const resultRows = aggregateRows(
        rows,
        analysisState.stat === 'custom' ? analysisState.customNumerator : analysisState.variable,
        analysisState.stat,
        analysisState.topic,
        analysisState.unit
    );

    const header = ['年度', '學院', '系所', '數值'];
    const lines = [
        header,
        ...resultRows.map(row => [row.年度, row.學院, row.系所, row.value])
    ];

    const csv = '\uFEFF' + lines.map(row =>
        row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `教師授課分析_${analysisState.topic}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

function openDepartmentAnalysis(department) {
    const page = document.getElementById('analysis-department');
    const select = document.getElementById('department-analysis-select');

    if (typeof switchAnalysisTab === 'function') switchAnalysisTab('department');
    if (select) {
        select.value = department;
        if (typeof loadDepartmentAnalysis === 'function') loadDepartmentAnalysis();
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function initTeacherAnalysis() {
    if (!document.getElementById('analysis-school')) return;
    loadAnalysisData();
}

document.addEventListener('DOMContentLoaded', initTeacherAnalysis);


/* =========================================================
 * B：各系所分析
 * ========================================================= */

const departmentState = {
    selectedCollege: '',
    selectedDepartment: '',
    salaryMode: 'total',
    charts: {}
};

const DEPARTMENT_COURSE_CATEGORIES = [
    {label:'必修', key:'必修'},
    {label:'選修', key:'選修'},
    {label:'通識', key:'通識'},
    {label:'大一國文', key:'大一國文'},
    {label:'基礎', key:'基礎'}
];

const DEPARTMENT_SALARY_FIELDS = [
    '正課','實習','大班','遠距','外語','行政減授',
    '進修學士班折抵','新進教師減授及返還','計畫類','指導研究生'
];

function departmentRowDepartment(row) {
    return row.系所 || row.單位 || '';
}

function departmentRows(topic) {
    return analysisNormalizeRows(topic).filter(row =>
        departmentRowDepartment(row) === departmentState.selectedDepartment
    );
}

function departmentLatestRow(topic) {
    const rows = departmentRows(topic);
    if (!rows.length) return null;
    return [...rows].sort((a,b) => Number(b.__year) - Number(a.__year))[0];
}

function departmentNumber(row, field) {
    return analysisNumber(row?.[field]);
}

function departmentAverage(row, field) {
    const teachers = departmentNumber(row, '教師人數');
    return teachers ? departmentNumber(row, field) / teachers : null;
}

function departmentFormat(value, suffix='') {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
    const n = Number(value);
    const digits = Math.abs(n % 1) < 0.000001 ? 0 : 2;
    return `${n.toLocaleString('zh-TW', {minimumFractionDigits:digits, maximumFractionDigits:2})}${suffix}`;
}

function departmentCourseField(prefix, unit) {
    return `${prefix}${unit}`;
}

function departmentCourseValue(row, prefix, unit, stat='sum') {
    const field = departmentCourseField(prefix, unit);
    const value = departmentNumber(row, field);
    if (stat === 'average') {
        const teachers = departmentNumber(row, '教師人數');
        return teachers ? value / teachers : 0;
    }
    return value;
}

function departmentChartDestroy(key) {
    if (departmentState.charts[key]) {
        departmentState.charts[key].destroy();
        departmentState.charts[key] = null;
    }
}

function departmentMakeBarChart(canvasId, key, labels, values, options={}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;
    departmentChartDestroy(key);

    departmentState.charts[key] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: options.label || '',
                data: values,
                borderWidth: 1,
                maxBarThickness: 48
            }]
        },
        options: {
            responsive:true,
            maintainAspectRatio:false,
            indexAxis: options.horizontal ? 'y' : 'x',
            plugins:{
                legend:{display:Boolean(options.label)},
                tooltip:{
                    callbacks:{
                        label: ctx => `${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${departmentFormat(ctx.parsed[options.horizontal ? 'x' : 'y'], options.suffix || '')}`
                    }
                }
            },
            scales:{
                x:{title:{display:true,text:options.horizontal ? (options.suffixLabel || '數值') : '項目'}},
                y:{title:{display:true,text:options.horizontal ? '項目' : (options.suffixLabel || '數值')}}
            }
        }
    });
}

function departmentMakeLineChart(canvasId, key, labels, datasets, suffix=' 小時') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;
    departmentChartDestroy(key);

    departmentState.charts[key] = new Chart(canvas.getContext('2d'), {
        type:'line',
        data:{labels, datasets:datasets.map(d => ({
            ...d, borderWidth:2, tension:.25, fill:false, pointRadius:4
        }))},
        options:{
            responsive:true, maintainAspectRatio:false,
            interaction:{mode:'index',intersect:false},
            plugins:{
                tooltip:{callbacks:{label:ctx => `${ctx.dataset.label}: ${departmentFormat(ctx.parsed.y,suffix)}`}},
                legend:{position:'bottom'}
            },
            scales:{
                x:{title:{display:true,text:'年度'}},
                y:{title:{display:true,text:suffix.replace(/^ /,'')}}
            }
        }
    });
}

function departmentMakeStackedChart(canvasId, key, labels, datasets, average=false) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;
    departmentChartDestroy(key);

    departmentState.charts[key] = new Chart(canvas.getContext('2d'), {
        type:'bar',
        data:{labels,datasets:datasets.map(d => ({...d,borderWidth:1}))},
        options:{
            responsive:true, maintainAspectRatio:false,
            plugins:{
                legend:{position:'bottom'},
                tooltip:{callbacks:{label:ctx => `${ctx.dataset.label}: ${departmentFormat(ctx.parsed.y,' 小時')}`}}
            },
            scales:{
                x:{stacked:true,title:{display:true,text:'年度'}},
                y:{stacked:true,title:{display:true,text:average?'每位教師平均時數':'時數'}}
            }
        }
    });
}

function initDepartmentSelectors() {
    const college = document.getElementById('department-analysis-college');
    const dept = document.getElementById('department-analysis-select');
    if (!college || !dept || !analysisState.loaded) return;

    const colleges = analysisUnique(analysisState.data.affairs.map(r => r.學院));
    college.innerHTML = `<option value="">請選擇學院</option>` +
        colleges.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

    const preferred = analysisState.data.affairs[0]?.學院 || '';
    departmentState.selectedCollege = colleges.includes(departmentState.selectedCollege)
        ? departmentState.selectedCollege : preferred;
    college.value = departmentState.selectedCollege;
    populateDepartmentSelector();
}

function populateDepartmentSelector() {
    const college = document.getElementById('department-analysis-college');
    const dept = document.getElementById('department-analysis-select');
    if (!college || !dept) return;

    departmentState.selectedCollege = college.value;
    const departments = analysisUnique(
        analysisState.data.affairs
            .filter(r => !departmentState.selectedCollege || r.學院 === departmentState.selectedCollege)
            .map(r => r.系所)
    );

    dept.innerHTML = `<option value="">請選擇系所</option>` +
        departments.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');

    if (!departments.includes(departmentState.selectedDepartment)) {
        departmentState.selectedDepartment = departments[0] || '';
    }
    dept.value = departmentState.selectedDepartment;
}

function departmentCollegeChanged() {
    populateDepartmentSelector();
    loadDepartmentAnalysis();
}

function loadDepartmentAnalysis() {
    if (!analysisState.loaded) return;
    const select = document.getElementById('department-analysis-select');
    if (select) departmentState.selectedDepartment = select.value;

    if (!departmentState.selectedDepartment) {
        renderDepartmentEmpty();
        return;
    }

    renderDepartmentOverview();
    renderDepartmentTeachtime();
    renderDepartmentSalary();
    updateDepartmentCourseCharts();
    updateDepartmentLargeChart();
    updateDepartmentSupportChart();
    renderDepartmentGraduate();

    const status = document.getElementById('department-analysis-status');
    if (status) status.textContent = `目前分析系所：${departmentState.selectedDepartment}`;
}

function renderDepartmentEmpty() {
    const status = document.getElementById('department-analysis-status');
    if (status) status.textContent = '請選擇學院與系所。';
    const cards = document.getElementById('department-overview-cards');
    if (cards) cards.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8">請先選擇系所。</div>';
}

function renderDepartmentOverview() {
    const target = document.getElementById('department-overview-cards');
    if (!target) return;

    const teach = departmentLatestRow('teachtime');
    const course = departmentLatestRow('course');
    const salary = departmentLatestRow('salary');

    const teachers = departmentNumber(teach,'教師人數') || departmentNumber(course,'教師人數') || departmentNumber(salary,'教師人數');
    const actual = departmentNumber(teach,'實際授課時數');
    const avg = teachers ? actual / teachers : null;

    const cards = [
        ['教師人數', teachers, ' 人'],
        ['實際授課時數', actual, ' 小時'],
        ['平均授課時數', avg, ' 小時'],
        ['開課學分', departmentNumber(course,'學分加總'), ' 學分'],
        ['開課時數', departmentNumber(course,'時數加總'), ' 小時'],
        ['開課堂數', departmentNumber(course,'堂數加總'), ' 堂'],
        ['大班學分', departmentNumber(course,'大班學分加總'), ' 學分'],
        ['大班時數', departmentNumber(course,'大班時數加總'), ' 小時'],
        ['大班堂數', departmentNumber(course,'大班堂數加總'), ' 堂'],
        ['支援外系學分', departmentNumber(course,'支援學分加總'), ' 學分'],
        ['支援外系時數', departmentNumber(course,'支援時數加總'), ' 小時'],
        ['支援外系堂數', departmentNumber(course,'支援堂數加總'), ' 堂']
    ];

    target.innerHTML = cards.map(([label,value,suffix]) => `
        <div class="bg-gray-50 rounded-xl border border-gray-200/70 p-4">
            <div class="text-xs font-bold text-gray-500 mb-2">${escapeHtml(label)}</div>
            <div class="text-xl font-black text-ntpuBlue">${departmentFormat(value,suffix)}</div>
        </div>
    `).join('');
}

function renderDepartmentTeachtime() {
    const rows = departmentRows('teachtime').sort((a,b) => Number(a.__year)-Number(b.__year));
    const years = rows.map(r => r.__year);
    const actual = rows.map(r => departmentNumber(r,'實際授課時數'));
    const avg = rows.map(r => departmentAverage(r,'實際授課時數'));
    const weighted = rows.map(r => departmentNumber(r,'加權授課時數'));

    departmentMakeLineChart('department-teachtime-chart','teachtime',years,[
        {label:'實際授課時數',data:actual},
        {label:'平均授課時數',data:avg},
        {label:'加權授課時數',data:weighted}
    ]);
}

function setDepartmentSalaryMode(mode) {
    departmentState.salaryMode = mode;
    document.getElementById('salary-mode-total')?.classList.toggle('bg-ntpuBlue', mode==='total');
    document.getElementById('salary-mode-total')?.classList.toggle('text-white', mode==='total');
    document.getElementById('salary-mode-average')?.classList.toggle('bg-ntpuBlue', mode==='average');
    document.getElementById('salary-mode-average')?.classList.toggle('text-white', mode==='average');
    document.getElementById('salary-mode-total')?.classList.toggle('text-gray-600', mode!=='total');
    document.getElementById('salary-mode-average')?.classList.toggle('text-gray-600', mode!=='average');
    renderDepartmentSalary();
}

function renderDepartmentSalary() {
    const rows = departmentRows('salary').sort((a,b) => Number(a.__year)-Number(b.__year));
    const years = rows.map(r => r.__year);
    const average = departmentState.salaryMode === 'average';

    const datasets = DEPARTMENT_SALARY_FIELDS.map(field => ({
        label:field,
        data:rows.map(r => average ? departmentAverage(r,field) : departmentNumber(r,field))
    }));

    departmentMakeStackedChart('department-salary-chart','salary',years,datasets,average);
}

function updateDepartmentCourseCharts() {
    const row = departmentLatestRow('course');
    const unit = document.getElementById('department-course-unit')?.value || '學分';
    const stat = document.getElementById('department-course-stat')?.value || 'sum';

    const prefixes = DEPARTMENT_COURSE_CATEGORIES.map(x => x.key);
    const labels = DEPARTMENT_COURSE_CATEGORIES.map(x => x.label);
    const values = prefixes.map(prefix => departmentCourseValue(row,prefix,unit,stat));

    departmentMakeBarChart(
        'department-course-chart','course',
        labels,values,
        {horizontal:true,label:stat==='average'?'教師平均':'加總',suffix:unit==='學分'?' 學分':unit==='時數'?' 小時':' 堂',suffixLabel:unit}
    );
}

function updateDepartmentLargeChart() {
    const row = departmentLatestRow('course');
    const unit = document.getElementById('department-large-unit')?.value || '學分';
    const prefixes = DEPARTMENT_COURSE_CATEGORIES.map(x => x.key + '大班');
    const labels = DEPARTMENT_COURSE_CATEGORIES.map(x => x.label);
    const values = prefixes.map(prefix => departmentCourseValue(row,prefix,unit,'sum'));

    departmentMakeBarChart(
        'department-large-chart','large',
        labels,values,
        {horizontal:true,label:`大班${unit}`,suffix:unit==='學分'?' 學分':unit==='時數'?' 小時':' 堂',suffixLabel:unit}
    );
}

function updateDepartmentSupportChart() {
    const row = departmentLatestRow('course');
    const unit = document.getElementById('department-support-unit')?.value || '學分';
    const prefixes = DEPARTMENT_COURSE_CATEGORIES.map(x => x.key + '支援');
    const labels = DEPARTMENT_COURSE_CATEGORIES.map(x => x.label);
    const values = prefixes.map(prefix => departmentCourseValue(row,prefix,unit,'sum'));

    departmentMakeBarChart(
        'department-support-chart','support',
        labels,values,
        {horizontal:true,label:`支援外系${unit}`,suffix:unit==='學分'?' 學分':unit==='時數'?' 小時':' 堂',suffixLabel:unit}
    );
}

function graduateField(row, primary, fallback=0) {
    return analysisNumber(row?.[primary] ?? fallback);
}

function renderDepartmentGraduate() {
    const rows = departmentRows('graduate').sort((a,b) => Number(a.__year)-Number(b.__year));
    const latest = rows[rows.length-1];

    const overviewLabels = ['系必修','院必修／外系列入系必修','系定選修','通識共同必修','其他','總學分數'];
    const overviewValues = latest ? [
        graduateField(latest,'系必修'),
        graduateField(latest,'院必修或外系開設列入系必修學分數'),
        graduateField(latest,'系定選修'),
        graduateField(latest,'通識共同必修'),
        graduateField(latest,'其他(含自由選修）'),
        graduateField(latest,'總學分數')
    ] : [];

    departmentMakeBarChart(
        'department-graduate-overview-chart','graduateOverview',
        overviewLabels,overviewValues,
        {horizontal:true,label:'學分',suffix:' 學分',suffixLabel:'學分'}
    );

    departmentMakeLineChart(
        'department-graduate-trend-chart','graduateTrend',
        rows.map(r => r.__year),
        [{label:'總學分數',data:rows.map(r => graduateField(r,'總學分數'))}],
        ' 學分'
    );
}

/* =========================================================
 * C：檢視資料
 * ========================================================= */

const dataExplorerState = {
    dataset:'teachtime',
    selectedColumns:[],
    sortField:null,
    sortDirection:'asc',
    filteredRows:[]
};

const DATA_EXPLORER_LABELS = {
    teachtime:'授課時數',
    salary:'教師鐘點費結構',
    graduate:'學士班畢業學分',
    course:'114 開課現況'
};

function dataExplorerDepartment(row) {
    return row.系所 || row.單位 || '';
}

function dataExplorerRows() {
    return analysisState.data[dataExplorerState.dataset] || [];
}

function dataExplorerAllColumns() {
    const rows = dataExplorerRows();
    const seen = new Set();
    rows.forEach(row => Object.keys(row).forEach(k => seen.add(k)));
    return [...seen];
}

function dataExplorerYears() {
    const years = analysisUnique(
        dataExplorerRows().map(r => dataExplorerState.dataset === 'course' ? 114 : Number(r.年度))
    ).sort((a,b)=>Number(a)-Number(b));
    return years;
}

function initDataExplorer() {
    if (!analysisState.loaded) return;
    const dataset = document.getElementById('data-explorer-dataset');
    if (dataset) dataset.value = dataExplorerState.dataset;
    populateDataExplorerFilters();
    renderDataExplorerColumns();
    updateDataExplorer();
}

function dataExplorerDatasetChanged() {
    dataExplorerState.dataset = document.getElementById('data-explorer-dataset').value;
    dataExplorerState.sortField = null;
    dataExplorerState.sortDirection = 'asc';
    dataExplorerState.selectedColumns = [];
    populateDataExplorerFilters();
    renderDataExplorerColumns();
    updateDataExplorer();
}

function populateDataExplorerFilters() {
    const year = document.getElementById('data-explorer-year');
    const college = document.getElementById('data-explorer-college');
    const dept = document.getElementById('data-explorer-department');
    if (!year || !college || !dept) return;

    const years = dataExplorerYears();
    year.innerHTML = `<option value="">全部</option>` + years.map(y => `<option value="${y}">${y}</option>`).join('');

    const colleges = analysisUnique(analysisState.data.affairs.map(r => r.學院));
    college.innerHTML = `<option value="">全部</option>` +
        colleges.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

    populateDataExplorerDepartments();
}

function dataExplorerCollegeChanged() {
    populateDataExplorerDepartments();
    updateDataExplorer();
}

function populateDataExplorerDepartments() {
    const college = document.getElementById('data-explorer-college')?.value || '';
    const dept = document.getElementById('data-explorer-department');
    if (!dept) return;

    const departments = analysisUnique(
        analysisState.data.affairs
            .filter(r => !college || r.學院 === college)
            .map(r => r.系所)
    );

    dept.innerHTML = `<option value="">全部</option>` +
        departments.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
}

function renderDataExplorerColumns() {
    const container = document.getElementById('data-explorer-columns');
    if (!container) return;

    const columns = dataExplorerAllColumns();
    if (!dataExplorerState.selectedColumns.length) {
        dataExplorerState.selectedColumns = columns.slice();
    }

    dataExplorerState.selectedColumns =
        dataExplorerState.selectedColumns.filter(c => columns.includes(c));

    container.innerHTML = columns.map((column,index) => {
        const checked = dataExplorerState.selectedColumns.includes(column) ? 'checked' : '';
        return `
            <label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" class="data-column-check" value="${escapeHtml(column)}" ${checked}
                       onchange="dataExplorerColumnsChanged()">
                <span class="text-xs text-gray-700 break-all">${escapeHtml(column)}</span>
            </label>`;
    }).join('');
}

function dataExplorerColumnsChanged() {
    dataExplorerState.selectedColumns = [...document.querySelectorAll('.data-column-check:checked')].map(el => el.value);
    renderDataExplorerTable();
}

function selectAllDataColumns(selectAll=true) {
    const columns = dataExplorerAllColumns();
    dataExplorerState.selectedColumns = selectAll ? columns.slice() : [];
    renderDataExplorerColumns();
    renderDataExplorerTable();
}

function updateDataExplorer() {
    if (!analysisState.loaded) return;

    const yearValue = document.getElementById('data-explorer-year')?.value || '';
    const collegeValue = document.getElementById('data-explorer-college')?.value || '';
    const deptValue = document.getElementById('data-explorer-department')?.value || '';
    const searchValue = (document.getElementById('data-explorer-search')?.value || '').trim().toLowerCase();

    const rows = dataExplorerRows().filter(row => {
        const year = dataExplorerState.dataset === 'course' ? 114 : Number(row.年度);
        const department = dataExplorerDepartment(row);
        const college = analysisCollegeMap()[department] || row.學院 || '';

        return (!yearValue || Number(year) === Number(yearValue)) &&
               (!collegeValue || college === collegeValue) &&
               (!deptValue || department === deptValue) &&
               (!searchValue || department.toLowerCase().includes(searchValue));
    });

    dataExplorerState.filteredRows = rows;
    renderDataExplorerTable();

    const status = document.getElementById('data-explorer-status');
    if (status) status.textContent = `目前資料集：${DATA_EXPLORER_LABELS[dataExplorerState.dataset]}｜符合 ${rows.length} 筆`;
}

function dataExplorerSort(field) {
    if (dataExplorerState.sortField === field) {
        dataExplorerState.sortDirection = dataExplorerState.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        dataExplorerState.sortField = field;
        dataExplorerState.sortDirection = 'asc';
    }
    renderDataExplorerTable();
}

function renderDataExplorerTable() {
    const head = document.getElementById('data-explorer-head');
    const body = document.getElementById('data-explorer-body');
    const count = document.getElementById('data-explorer-count');
    if (!head || !body) return;

    const columns = dataExplorerState.selectedColumns;
    let rows = [...dataExplorerState.filteredRows];

    if (dataExplorerState.sortField) {
        const field = dataExplorerState.sortField;
        const direction = dataExplorerState.sortDirection === 'asc' ? 1 : -1;
        rows.sort((a,b) => {
            const av = a[field] ?? '';
            const bv = b[field] ?? '';
            const an = Number(av), bn = Number(bv);
            if (av !== '' && bv !== '' && Number.isFinite(an) && Number.isFinite(bn)) return (an-bn)*direction;
            return String(av).localeCompare(String(bv),'zh-Hant',{numeric:true})*direction;
        });
    }

    head.innerHTML = `<tr>${columns.map(column => {
        const arrow = dataExplorerState.sortField === column
            ? (dataExplorerState.sortDirection === 'asc' ? ' ↑' : ' ↓') : '';
        return `<th class="px-3 py-3 text-left cursor-pointer hover:bg-blue-800" onclick="dataExplorerSort(${JSON.stringify(column)})">${escapeHtml(column)}${arrow}</th>`;
    }).join('')}</tr>`;

    body.innerHTML = rows.map(row => `<tr class="border-t border-gray-100 hover:bg-gray-50">
        ${columns.map(column => {
            const value = row[column];
            if (column === '系所' || column === '單位') {
                const dept = dataExplorerDepartment(row);
                return `<td class="px-3 py-2">
                    <button type="button" class="text-ntpuBlue hover:underline font-semibold"
                            onclick="openDepartmentAnalysis(${JSON.stringify(dept)})">
                        ${escapeHtml(String(value ?? ''))}
                    </button>
                </td>`;
            }
            return `<td class="px-3 py-2">${escapeHtml(String(value ?? ''))}</td>`;
        }).join('')}
    </tr>`).join('');

    if (count) count.textContent = `共 ${rows.length} 筆`;
}

function downloadDataExplorerCSV() {
    const columns = dataExplorerState.selectedColumns;
    const rows = dataExplorerState.filteredRows;

    if (!columns.length) {
        alert('請至少選擇一個顯示欄位。');
        return;
    }

    const csv = '\uFEFF' + [
        columns,
        ...rows.map(row => columns.map(c => row[c] ?? ''))
    ].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');

    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `資料檢視_${dataExplorerState.dataset}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

/* 覆寫 A 原本的跳轉函式：跳 B 時同步更新學院與系所。 */
function openDepartmentAnalysis(department) {
    if (!department) return;

    const collegeMap = analysisCollegeMap();
    departmentState.selectedDepartment = department;
    departmentState.selectedCollege = collegeMap[department] || '';

    if (typeof switchAnalysisTab === 'function') switchAnalysisTab('department');

    initDepartmentSelectors();

    const college = document.getElementById('department-analysis-college');
    const select = document.getElementById('department-analysis-select');

    if (college) college.value = departmentState.selectedCollege;
    populateDepartmentSelector();
    if (select) select.value = department;
    departmentState.selectedDepartment = department;

    loadDepartmentAnalysis();
}

const originalLoadAnalysisData = loadAnalysisData;
loadAnalysisData = async function() {
    await originalLoadAnalysisData();
    if (!analysisState.loaded) return;
    initDepartmentSelectors();
    initDataExplorer();
};

/* 使用者切到 B/C 時，若資料已完成載入就初始化。 */
const originalSwitchAnalysisTab = window.switchAnalysisTab;
window.switchAnalysisTab = function(tab) {
    if (typeof originalSwitchAnalysisTab === 'function') originalSwitchAnalysisTab(tab);
    if (!analysisState.loaded) return;

    if (tab === 'department') {
        initDepartmentSelectors();
        loadDepartmentAnalysis();
    }
    if (tab === 'data') {
        initDataExplorer();
    }
};
