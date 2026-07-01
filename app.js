(function () {
  const storageKey = "incoming-screening-cycle-system-v2";
  const legacyStorageKey = "incoming-screening-cycle-system-v1";

  const status = {
    fullCheck: "全检中",
    observe: "观察中",
    paused: "暂停",
    closed: "已关闭",
  };

  const defaultRules = [
    {
      id: "rule-level-1",
      level: "Level 1",
      risk: "有流到下一车间的风险，产线无法有效探测",
      typical: "可靠性缺陷、探测手段缺失的问题",
      cycle: "持续至断点",
      method: "来料 100%全检",
      stopCondition: "供应商长期措施验证 + 明确断点 + 7天内跟踪",
      observeCycle: "断点确认后按7天跟踪",
      closeCondition: "断点有效 + 7天内无再次发生 + QE确认",
    },
    {
      id: "rule-level-2",
      level: "Level 2",
      risk: "供应商技术问题导致的偏差，装配时可发现",
      typical: "尺寸不良、配合问题",
      cycle: "7个工作日",
      method: "来料 100%全检，产线辅助",
      stopCondition: "7天内无再次发生 + 连续3批次合格",
      observeCycle: "每7个工作日抽检1次",
      closeCondition: "连续3次观察抽检合格",
    },
    {
      id: "rule-level-3",
      level: "Level 3",
      risk: "供应商技术问题导致的外观偏差",
      typical: "多肉、加工残留、轻微外观缺陷",
      cycle: "3个工作日",
      method: "来料 100%全检，产线辅助",
      stopCondition: "3天内无再次发生 + 连续3批次合格",
      observeCycle: "每3个工作日抽检1次",
      closeCondition: "连续3次观察抽检合格",
    },
    {
      id: "rule-level-4",
      level: "Level 4",
      risk: "物流/运输/包装导致的问题",
      typical: "包装破损、磕碰、挤压变形等偏差",
      cycle: "1个工作日",
      method: "来料 100%全检，产线辅助",
      stopCondition: "3天内无再次发生 + 连续3批次合格",
      observeCycle: "每1个工作日抽检1次",
      closeCondition: "连续3次观察抽检合格",
    },
  ];

  const defaultState = {
    rules: defaultRules,
    tasks: [
      {
        id: "SCR-20260628-001",
        source: "产线异常",
        materialCode: "DIFF-HOUSING-001",
        materialName: "Diff壳体",
        supplier: "示例供应商A",
        screeningContent: "壳体磕碰筛选，覆盖库存和后续来料",
        level: "Level 4",
        startDate: today(),
        endDate: addWorkdays(today(), 1),
        stage: status.fullCheck,
        paused: "否",
        owner: "来料",
        note: "示例任务，可直接编辑或删除。",
      },
    ],
    records: [
      {
        id: "rec-001",
        taskId: "SCR-20260628-001",
        batch: "LOT-001",
        stage: "全检",
        screeningDate: today(),
        qty: 200,
        defectQty: 0,
        sameIssue: "否",
        result: "合格",
        action: "放行",
        inspector: "来料",
        defectDesc: "",
      },
    ],
    incomingItems: [
      {
        id: "INSP-ITEM-001",
        partNumber: "DIFF-HOUSING-001",
        partName: "Diff壳体",
        supplier: "示例供应商A",
        grDate: today(),
        inspectionContent: "Q状态到货后核对外观磕碰和包装状态",
        ownerDepartment: "来料",
        status: "启用",
        note: "示例进料检验项目，可直接编辑或删除。",
      },
    ],
    incomingBatches: [
      {
        id: "INSP-BATCH-001",
        itemId: "INSP-ITEM-001",
        arrivalDate: today(),
        huNo: "HU-0001",
        qty: 120,
        location: "待检区",
        inspector: "",
        inspectionDate: "",
        result: "待检",
        defectDesc: "",
        action: "",
        note: "",
      },
    ],
  };

  let state = normalizeState(loadState());
  let activeView = "daily";
  let editing = null;
  let detailTaskId = null;
  let dailyDate = today();
  let selectedProjectId = "";
  const filters = {
    search: "",
    level: "",
    stage: "",
    supplier: "",
    dateFrom: "",
    dateTo: "",
  };

  const viewTitles = {
    daily: "筛选工作台",
    dashboard: "看板",
    tasks: "筛选项目管理",
    incoming: "进料检验",
    rules: "周期规则",
    settings: "数据管理",
  };

  const fields = {
    rule: [
      ["level", "等级", "text"],
      ["risk", "风险描述", "textarea", "full"],
      ["typical", "典型问题", "textarea", "full"],
      ["cycle", "全检周期", "text"],
      ["method", "筛选方式", "text"],
      ["stopCondition", "停止全检条件", "textarea", "full"],
      ["observeCycle", "观察周期", "text"],
      ["closeCondition", "关闭条件", "textarea", "full"],
    ],
    task: [
      ["source", "异常来源", "select", "", ["产线异常", "来料异常", "客户投诉", "供应商通知", "工程变更"]],
      ["level", "风险等级", "select", "", () => state.rules.map((rule) => rule.level)],
      ["materialCode", "零件号", "text"],
      ["materialName", "物料名称", "text"],
      ["supplier", "供应商", "text"],
      ["startDate", "启动日期", "date"],
      ["endDate", "结束日期", "date"],
      ["stage", "当前阶段", "select", "", [status.fullCheck, status.observe, status.paused, status.closed]],
      ["paused", "来料中断", "select", "", ["否", "是"]],
      ["owner", "责任部门", "text"],
      ["screeningContent", "筛选内容", "textarea", "full"],
      ["note", "备注", "textarea", "full"],
    ],
    record: [
      ["taskId", "任务单号", "select", "", () => state.tasks.map((task) => task.id)],
      ["batch", "来料批次", "text"],
      ["stage", "筛选阶段", "select", "", ["全检", "观察抽检", "补检"]],
      ["screeningDate", "筛选日期", "date"],
      ["qty", "筛选数量", "number"],
      ["defectQty", "不良数量", "number"],
      ["sameIssue", "是否同类不良", "select", "", ["否", "是"]],
      ["result", "判定结果", "select", "", ["合格", "不合格", "待判定"]],
      ["action", "处理方式", "select", "", ["放行", "冻结", "退货", "特采", "重工", "待判定"]],
      ["inspector", "检验员", "text"],
      ["defectDesc", "不良现象", "textarea", "full"],
    ],
    incomingItem: [
      ["partNumber", "零件号", "text"],
      ["partName", "物料名称", "text"],
      ["supplier", "供应商", "text"],
      ["grDate", "GR日期", "date"],
      ["ownerDepartment", "责任部门", "text"],
      ["status", "状态", "select", "", ["启用", "关闭"]],
      ["inspectionContent", "检验内容", "textarea", "full"],
      ["note", "备注", "textarea", "full"],
    ],
    incomingBatch: [
      ["itemId", "Q状态项目", "select", "", () => state.incomingItems.map((item) => [item.id, `${item.partNumber} · ${item.supplier}`])],
      ["arrivalDate", "GR日期", "date"],
      ["huNo", "HU号", "textarea", "full"],
      ["qty", "到货数量", "number"],
      ["location", "仓库/库位", "text"],
      ["inspector", "检验员", "text"],
      ["inspectionDate", "检验日期", "date"],
      ["result", "检验结果", "select", "", ["待检", "合格", "不合格", "待判定"]],
      ["action", "处理方式", "select", "", ["", "放行", "冻结", "退货", "特采", "待判定"]],
      ["defectDesc", "异常说明", "textarea", "full"],
      ["note", "备注", "textarea", "full"],
    ],
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindNavigation();
    bindActions();
    await loadSharedState();
    saveState();
    render();
  }

  function bindNavigation() {
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.addEventListener("click", () => {
        activeView = button.dataset.view;
        document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        render();
      });
    });
  }

  function bindActions() {
    byId("dailyDateInput").addEventListener("change", (event) => {
      dailyDate = event.target.value || today();
      renderDaily();
    });
    byId("newTaskBtn").addEventListener("click", () => openEditor("task"));
    byId("taskAddBtn").addEventListener("click", () => openEditor("task"));
    byId("ruleAddBtn").addEventListener("click", () => openEditor("rule"));
    byId("exportDataBtn").addEventListener("click", downloadJson);
    byId("downloadBtn").addEventListener("click", downloadJson);
    byId("resetBtn").addEventListener("click", resetData);
    byId("importInput").addEventListener("change", importJson);
    byId("taskExcelInput").addEventListener("change", (event) => importTableFile(event, "task"));
    byId("recordExcelInput").addEventListener("change", (event) => importTableFile(event, "record"));
    byId("taskTemplateBtn").addEventListener("click", () => downloadTemplate("task"));
    byId("recordTemplateBtn").addEventListener("click", () => downloadTemplate("record"));
    byId("incomingItemAddBtn").addEventListener("click", () => openEditor("incomingItem"));
    byId("incomingSearchInput").addEventListener("input", renderIncomingInspection);
    byId("clearFiltersBtn").addEventListener("click", clearFilters);
    byId("taskSearchInput").addEventListener("input", (event) => updateFilter("search", event.target.value));
    byId("levelFilter").addEventListener("change", (event) => updateFilter("level", event.target.value));
    byId("stageFilter").addEventListener("change", (event) => updateFilter("stage", event.target.value));
    byId("supplierFilter").addEventListener("change", (event) => updateFilter("supplier", event.target.value));
    byId("dateFromFilter").addEventListener("change", (event) => updateFilter("dateFrom", event.target.value));
    byId("dateToFilter").addEventListener("change", (event) => updateFilter("dateTo", event.target.value));
    byId("closeDetailBtn").addEventListener("click", closeDetail);
    byId("detailCloseBtn").addEventListener("click", closeDetail);
    byId("detailEditBtn").addEventListener("click", editDetailTask);
    byId("dashboardProjectSearch").addEventListener("input", renderProjectSearch);
    byId("editorForm").addEventListener("submit", saveEditor);
  }

  function render() {
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    byId(`${activeView}View`).classList.add("active");
    byId("viewTitle").textContent = viewTitles[activeView];
    renderFilters();
    renderDaily();
    renderDashboard();
    renderTasks();
    renderIncomingInspection();
    renderDailySummary();
    renderRules();
    renderDataStatus();
  }

  function renderFilters() {
    const levels = [...new Set(state.rules.map((rule) => rule.level).filter(Boolean))];
    const suppliers = [...new Set(state.tasks.map((task) => task.supplier).filter(Boolean))].sort();
    renderSelectOptions(byId("levelFilter"), [["", "全部等级"], ...levels.map((level) => [level, level])], filters.level);
    renderSelectOptions(byId("supplierFilter"), [["", "全部供应商"], ...suppliers.map((supplier) => [supplier, supplier])], filters.supplier);
    byId("taskSearchInput").value = filters.search;
    byId("stageFilter").value = filters.stage;
    byId("dateFromFilter").value = filters.dateFrom;
    byId("dateToFilter").value = filters.dateTo;
  }

  function renderSelectOptions(select, options, selectedValue) {
    select.innerHTML = options
      .map(([value, label]) => `<option value="${escapeAttr(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`)
      .join("");
  }

  function updateFilter(key, value) {
    filters[key] = value;
    renderTasks();
  }

  function clearFilters() {
    Object.keys(filters).forEach((key) => {
      filters[key] = "";
    });
    render();
  }

  function renderDaily() {
    byId("dailyDateInput").value = dailyDate;
    const rows = dailyTasksForDate(dailyDate);
    byId("dailyTaskCount").textContent = formatNumber(rows.length);
    byId("dailyRows").innerHTML = rows.length
      ? rows.map(dailyRow).join("")
      : `<tr><td colspan="11" class="empty">该日期没有需要筛选的未关闭项目。</td></tr>`;
  }

  function dailyTasksForDate(date) {
    return state.tasks
      .map(taskSummary)
      .filter((task) => task.stage !== status.closed && normalizeDate(task.startDate) <= date)
      .map((task) => {
        const record = dailyRecordForTaskDate(task.id, date);
        const qty = record ? toNumber(record.qty) : 0;
        const defectQty = record ? toNumber(record.defectQty) : 0;
        const selectedOverdue = Boolean(task.endDate && date > task.endDate);
        return {
          ...task,
          selectedOverdue,
          qty,
          defectQty,
          defectRate: qty > 0 ? defectQty / qty : 0,
        };
      });
  }

  function dailyRow(task) {
    const rowState = task.selectedOverdue ? badgeText("超期", "overdue") : stageBadge(task.stage);
    const key = domId(task.id);
    const taskArg = jsString(task.id);
    return `
      <tr class="${task.selectedOverdue ? "overdue-row" : ""}">
        <td>${rowState}</td>
        <td>${escapeHtml(task.id)}</td>
        <td>${escapeHtml(task.materialCode)}<br><span class="muted">${escapeHtml(task.materialName)}</span></td>
        <td>${escapeHtml(task.supplier)}</td>
        <td>${escapeHtml(task.screeningContent || "")}</td>
        <td>${levelBadge(task.level)}</td>
        <td>${dateWithSelectedOverdue(task)}</td>
        <td><input class="table-input" id="dailyQty-${key}" type="number" min="0" value="${escapeAttr(task.qty)}" oninput="window.appDailyInput('${taskArg}')" /></td>
        <td><input class="table-input" id="dailyDefect-${key}" type="number" min="0" value="${escapeAttr(task.defectQty)}" oninput="window.appDailyInput('${taskArg}')" /></td>
        <td><strong id="dailyRate-${key}">${formatRate(task.defectRate)}</strong></td>
        <td><button class="text-button" onclick="window.appSaveDaily('${taskArg}')">保存</button></td>
      </tr>
    `;
  }

  function handleDailyInput(taskId) {
    const key = domId(taskId);
    const qty = toNumber(byId(`dailyQty-${key}`)?.value);
    const defectQty = toNumber(byId(`dailyDefect-${key}`)?.value);
    const rateEl = byId(`dailyRate-${key}`);
    if (rateEl) {
      rateEl.textContent = formatRate(qty > 0 ? defectQty / qty : 0);
    }
  }

  function saveDailyRecord(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const key = domId(taskId);
    const qty = toNumber(byId(`dailyQty-${key}`)?.value);
    const defectQty = toNumber(byId(`dailyDefect-${key}`)?.value);
    const existing = dailyRecordForTaskDate(taskId, dailyDate);
    const record = existing || {
      id: `daily-${taskId}-${dailyDate}`,
      taskId,
      batch: `DAILY-${dailyDate}`,
      screeningDate: dailyDate,
      inspector: "来料",
      defectDesc: "每日筛选记录",
    };
    record.stage = task.stage === status.observe ? "观察抽检" : "全检";
    record.qty = qty;
    record.defectQty = defectQty;
    record.sameIssue = defectQty > 0 ? "是" : "否";
    record.result = defectQty > 0 ? "不合格" : "合格";
    record.action = defectQty > 0 ? "冻结" : "放行";
    const index = state.records.findIndex((item) => item.id === record.id);
    if (index >= 0) {
      state.records[index] = record;
    } else {
      state.records.push(record);
    }
    applyRecordResult(record);
    saveState();
    render();
    window.alert("每日筛选记录已保存。");
  }

  function dailyRecordForTaskDate(taskId, date) {
    return (
      state.records.find((record) => record.id === `daily-${taskId}-${date}`) ||
      state.records.find((record) => record.taskId === taskId && normalizeDate(record.screeningDate) === date)
    );
  }

  function dateWithSelectedOverdue(task) {
    const dateText = escapeHtml(task.endDate || "待确认");
    return task.selectedOverdue ? `${dateText}<br><span class="badge overdue">超期</span>` : dateText;
  }

  function renderDashboard() {
    const summaries = state.tasks.map(taskSummary);
    byId("metricActive").textContent = summaries.filter((item) => item.stage !== status.closed).length;
    byId("metricFullCheck").textContent = summaries.filter((item) => item.stage === status.fullCheck).length;
    byId("metricObserve").textContent = summaries.filter((item) => item.stage === status.observe).length;
    byId("metricOverdue").textContent = summaries.filter((item) => item.overdue).length;
    const todayProjectStats = dailyProjectStats(today());
    byId("metricTodayTaskTotal").textContent = formatNumber(todayProjectStats.total);
    byId("metricTodayTaskDefects").textContent = formatNumber(todayProjectStats.defective);
    byId("metricTodayTaskRate").textContent = formatRate(todayProjectStats.rate);

    const alertTasks = summaries.filter((item) => item.stage !== status.closed && item.overdue);
    byId("dashboardTaskRows").innerHTML = alertTasks.length
      ? alertTasks
          .map(
            (item) => `
          <tr class="${item.overdue ? "overdue-row" : ""}">
            <td>${escapeHtml(item.id)}</td>
            <td>${escapeHtml(item.materialCode)}<br><span class="muted">${escapeHtml(item.materialName)}</span></td>
            <td>${escapeHtml(item.supplier)}</td>
            <td>${levelBadge(item.level)}</td>
            <td>${stageBadge(item.stage)}</td>
            <td>${dateWithOverdue(item)}</td>
            <td>${item.passBatches}/3</td>
            <td>${item.observePasses}/3</td>
            <td>${escapeHtml(item.advice)}</td>
          </tr>
        `,
          )
          .join("")
      : `<tr><td colspan="9" class="empty">暂无超期提醒。</td></tr>`;
    renderProjectSearch();
  }

  function renderProjectSearch() {
    const input = byId("dashboardProjectSearch");
    const query = (input?.value || "").trim().toLowerCase();
    const matches = query
      ? state.tasks
          .map(taskSummary)
          .filter((task) => taskSearchText(task).includes(query))
          .slice(0, 8)
      : [];
    if (!selectedProjectId || !matches.some((task) => task.id === selectedProjectId)) {
      selectedProjectId = matches[0]?.id || "";
    }
    byId("projectSearchResults").innerHTML = matches.length
      ? matches
          .map(
            (task) => `
        <button class="result-pill ${task.id === selectedProjectId ? "active" : ""}" onclick="window.appSelectProject('${jsString(task.id)}')">
          ${escapeHtml(task.id)} · ${escapeHtml(task.materialCode)} · ${escapeHtml(task.supplier)}
        </button>
      `,
          )
          .join("")
      : `<span class="muted">输入关键词后显示匹配项目。</span>`;
    const selectedTask = state.tasks.find((task) => task.id === selectedProjectId);
    byId("projectStats").innerHTML = selectedTask ? projectStatsPanel(taskSummary(selectedTask)) : "";
  }

  function selectProject(id) {
    selectedProjectId = id;
    renderProjectSearch();
  }

  function taskSearchText(task) {
    return [
      task.id,
      task.source,
      task.materialCode,
      task.materialName,
      task.supplier,
      task.screeningContent,
      task.level,
      task.stage,
      task.owner,
    ]
      .join(" ")
      .toLowerCase();
  }

  function projectStatsPanel(task) {
    const records = state.records.filter((record) => record.taskId === task.id);
    const qty = records.reduce((sum, record) => sum + toNumber(record.qty), 0);
    const defectQty = records.reduce((sum, record) => sum + toNumber(record.defectQty), 0);
    const duration = screeningDuration(task, records);
    return `
      <div class="project-stat-grid">
        ${statCard("筛选时长", `${duration} 天`)}
        ${statCard("总筛选数量", formatNumber(qty))}
        ${statCard("总不良数量", formatNumber(defectQty))}
        ${statCard("总不良率", formatRate(qty > 0 ? defectQty / qty : 0))}
        ${statCard("当前状态", task.overdue ? "超期" : task.stage)}
        ${statCard("起止日期", `${task.startDate || "未填写"} - ${task.endDate || "未填写"}`)}
      </div>
    `;
  }

  function statCard(label, value) {
    return `<div class="detail-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function screeningDuration(task, records) {
    const start = parseDate(task.startDate);
    if (!start) return 0;
    const end = task.stage === status.closed ? parseDate(latestRecordDate(records) || task.endDate || today()) : parseDate(today());
    if (!end) return 0;
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.max(1, Math.floor((end - start) / msPerDay) + 1);
  }

  function latestRecordDate(records) {
    const dates = records
      .map((record) => normalizeDate(record.screeningDate))
      .filter(Boolean)
      .sort();
    return dates[dates.length - 1];
  }

  function renderTasks() {
    const summaries = state.tasks.map(taskSummary);
    const filteredTasks = filterTasks(summaries);
    const activeTasks = filteredTasks.filter((task) => task.stage !== status.closed);
    const closedTasks = filteredTasks.filter((task) => task.stage === status.closed);
    byId("activeTaskRows").innerHTML = activeTasks.length
      ? activeTasks.map((task) => taskRow(task, true)).join("")
      : `<tr><td colspan="9" class="empty">暂无正在筛选的任务，点击新增任务开始。</td></tr>`;
    byId("closedTaskRows").innerHTML = closedTasks.length
      ? closedTasks.map((task) => taskRow(task, false)).join("")
      : `<tr><td colspan="8" class="empty">暂无已关闭筛选任务。</td></tr>`;
  }

  function renderIncomingInspection() {
    const query = (byId("incomingSearchInput")?.value || "").trim().toLowerCase();
    const itemRows = state.incomingItems
      .map(incomingItemSummary)
      .filter((item) => incomingItemSearchText(item).includes(query))
      .sort((a, b) => String(b.grDate).localeCompare(String(a.grDate)));
    const pendingRows = itemRows.filter((item) => item.status !== "关闭" && item.pendingHuCount > 0);
    const doneRows = itemRows.filter((item) => item.huCount > 0 && item.pendingHuCount === 0);

    byId("incomingMetricItems").textContent = formatNumber(state.incomingItems.filter((item) => item.status !== "关闭").length);
    byId("incomingMetricPending").textContent = formatNumber(pendingRows.length);
    byId("incomingMetricOverdue").textContent = formatNumber(pendingRows.filter((item) => item.overdue).length);
    byId("incomingMetricDone").textContent = formatNumber(doneRows.length);

    byId("incomingPendingRows").innerHTML = pendingRows.length
      ? pendingRows.map(incomingPendingRow).join("")
      : `<tr><td colspan="8" class="empty">暂无待检HU。新增Q状态项目并填写HU后，未完成检验的项目会自动显示在这里。</td></tr>`;
    byId("incomingItemRows").innerHTML = itemRows.length
      ? itemRows.map(incomingItemRow).join("")
      : `<tr><td colspan="9" class="empty">暂无Q状态物料，点击“新增Q状态项目”开始。</td></tr>`;
    byId("incomingDoneRows").innerHTML = doneRows.length
      ? doneRows.map(incomingDoneRow).join("")
      : `<tr><td colspan="7" class="empty">暂无已完成记录。</td></tr>`;
  }

  function incomingItemRow(item) {
    return `
      <tr class="${item.overdue ? "overdue-row" : ""}">
        <td>${incomingItemStatusBadge(item)}</td>
        <td>${escapeHtml(item.grDate || "")}</td>
        <td>${escapeHtml(item.partNumber)}</td>
        <td>${escapeHtml(item.partName)}</td>
        <td>${escapeHtml(item.supplier)}</td>
        <td>${huProgressText(item)}</td>
        <td>${escapeHtml(item.inspectionContent || "")}</td>
        <td>${escapeHtml(item.ownerDepartment || "")}</td>
        <td>${rowActions("incomingItem", item.id)}</td>
      </tr>
    `;
  }

  function incomingPendingRow(item) {
    return `
      <tr class="${item.overdue ? "overdue-row" : ""}">
        <td>${incomingItemStatusBadge(item)}</td>
        <td>${escapeHtml(item.grDate || "")}</td>
        <td>${escapeHtml(item.partNumber)}</td>
        <td>${escapeHtml(item.supplier)}</td>
        <td>${huProgressText(item)}</td>
        <td>${huDetailList(item.batches)}</td>
        <td>${escapeHtml(item.inspectionContent || "")}</td>
        <td>${rowActions("incomingItem", item.id)}</td>
      </tr>
    `;
  }

  function incomingDoneRow(item) {
    return `
      <tr>
        <td>${escapeHtml(item.grDate || "")}</td>
        <td>${escapeHtml(item.partNumber)}</td>
        <td>${escapeHtml(item.supplier || "")}</td>
        <td>${huProgressText(item)}</td>
        <td>${huDetailList(item.batches)}</td>
        <td>${escapeHtml(item.inspectionContent || "")}</td>
        <td>${rowActions("incomingItem", item.id)}</td>
      </tr>
    `;
  }

  function incomingItemSummary(item) {
    const batches = state.incomingBatches.filter((batch) => batch.itemId === item.id);
    const huCount = batches.length;
    const doneHuCount = batches.filter((batch) => isHuDone(batch)).length;
    const pendingHuCount = Math.max(huCount - doneHuCount, huCount ? 0 : 1);
    const grDate = normalizeDate(item.grDate) || earliestIncomingBatchDate(batches) || today();
    return {
      ...item,
      grDate,
      batches,
      huCount,
      doneHuCount,
      pendingHuCount,
      overdue: item.status !== "关闭" && pendingHuCount > 0 && isIncomingOverdue(grDate),
      hasIssue: batches.some((batch) => batch.result === "不合格"),
    };
  }

  function incomingItemSearchText(item) {
    return [
      item.id,
      item.partNumber,
      item.partName,
      item.supplier,
      item.grDate,
      item.inspectionContent,
      item.ownerDepartment,
      item.status,
      item.note,
      item.batches?.map((batch) => [batch.huNo, batch.result, batch.inspector, batch.location, batch.defectDesc].join(" ")).join(" "),
    ]
      .join(" ")
      .toLowerCase();
  }

  function huDetailList(batches) {
    if (!batches.length) {
      return `<span class="muted">未填写HU</span>`;
    }
    return `
      <div class="hu-list">
        ${batches
          .map(
            (batch) => `
          <div class="hu-chip ${batch.result === "不合格" ? "fail" : ""}">
            <strong>${escapeHtml(batch.huNo || "未填写HU")}</strong>
            <span>${formatNumber(batch.qty)} · ${escapeHtml(batch.result || "待检")}</span>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  function huProgressText(item) {
    return item.huCount ? `${escapeHtml(item.doneHuCount)}/${escapeHtml(item.huCount)} 已检` : `<span class="muted">未填HU</span>`;
  }

  function incomingItemStatusBadge(item) {
    if (item.status === "关闭") return badgeText("关闭", "closed");
    if (item.overdue) return badgeText("超期未检", "overdue");
    if (item.hasIssue) return badgeText("有异常", "fail");
    if (item.pendingHuCount > 0) return badgeText("待检", "paused");
    return badgeText("已完成", "pass");
  }

  function earliestIncomingBatchDate(batches) {
    return batches.map((batch) => normalizeDate(batch.arrivalDate)).filter(Boolean).sort()[0] || "";
  }

  function isHuDone(batch) {
    return Boolean(batch.result && batch.result !== "待检");
  }

  function isIncomingOverdue(grDate) {
    const deadline = addCalendarDays(grDate, 2);
    return Boolean(deadline && today() >= deadline);
  }

  function taskRow(task, includeStage) {
    const content = task.screeningContent || task.issue || "";
    const stageColumn = includeStage ? `<td>${stageBadge(task.stage)}</td>` : "";
    return `
      <tr class="${task.overdue ? "overdue-row" : ""}">
        <td>${escapeHtml(task.id)}</td>
        <td>${escapeHtml(task.source)}</td>
        <td>${escapeHtml(task.materialCode)}<br><span class="muted">${escapeHtml(task.materialName)}</span></td>
        <td>${escapeHtml(content)}</td>
        <td>${levelBadge(task.level)}</td>
        ${stageColumn}
        <td>${escapeHtml(task.startDate)}</td>
        <td>${dateWithOverdue(task)}</td>
        <td>${rowActions("task", task.id)}</td>
      </tr>
    `;
  }

  function filterTasks(tasks) {
    const query = filters.search.trim().toLowerCase();
    return tasks.filter((task) => {
      const haystack = [
        task.id,
        task.source,
        task.materialCode,
        task.materialName,
        task.supplier,
        task.screeningContent,
        task.level,
        task.stage,
        task.owner,
      ]
        .join(" ")
        .toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (filters.level && task.level !== filters.level) return false;
      if (filters.stage && task.stage !== filters.stage) return false;
      if (filters.supplier && task.supplier !== filters.supplier) return false;
      if (filters.dateFrom && task.startDate < filters.dateFrom) return false;
      if (filters.dateTo && (task.endDate || "") > filters.dateTo) return false;
      return true;
    });
  }

  function renderDailySummary() {
    const summaries = dailySummaries(state.records);
    byId("dailySummaryRows").innerHTML = summaries.length
      ? summaries
          .map(
            (item) => `
          <tr>
            <td>${escapeHtml(item.date)}</td>
            <td>${formatNumber(item.qty)}</td>
            <td>${formatNumber(item.defectQty)}</td>
            <td>${formatRate(item.defectRate)}</td>
            <td>${formatNumber(item.taskCount)}</td>
            <td>${formatNumber(item.batchCount)}</td>
          </tr>
        `,
          )
          .join("")
      : `<tr><td colspan="6" class="empty">暂无每日筛选数据，录入筛选记录后会自动汇总。</td></tr>`;
  }

  function renderRules() {
    byId("ruleRows").innerHTML = state.rules.length
      ? state.rules
          .map(
            (rule) => `
        <tr>
          <td>${levelBadge(rule.level)}</td>
          <td>${escapeHtml(rule.risk)}</td>
          <td>${escapeHtml(rule.typical)}</td>
          <td>${escapeHtml(rule.cycle)}</td>
          <td>${escapeHtml(rule.method)}</td>
          <td>${escapeHtml(rule.stopCondition)}</td>
          <td>${escapeHtml(rule.observeCycle)}</td>
          <td>${escapeHtml(rule.closeCondition)}</td>
          <td>${rowActions("rule", rule.id)}</td>
        </tr>
      `,
          )
          .join("")
      : `<tr><td colspan="9" class="empty">暂无规则。</td></tr>`;
  }

  function renderDataStatus(message) {
    byId("dataStatus").textContent = JSON.stringify(
      {
        规则数: state.rules.length,
        任务数: state.tasks.length,
        记录数: state.records.length,
        进料检验项目数: state.incomingItems.length,
        到货HU记录数: state.incomingBatches.length,
        保存位置: isServerMode() ? "服务器 SQLite 共享数据库 + 浏览器本地备份" : "当前浏览器本地存储",
        最近操作: message || "无",
      },
      null,
      2,
    );
  }

  function openEditor(type, id) {
    const dialog = byId("editorDialog");
    const item = findItem(type, id) || createEmpty(type);
    if (type === "task" && !item.endDate) {
      item.endDate = calculateEndDate(item.startDate, item.level);
    }
    editing = { type, id: item.id };
    byId("dialogTitle").textContent = `${id ? "编辑" : "新增"}${typeName(type)}`;
    byId("formFields").innerHTML = fields[type].map((field) => renderField(field, item)).join("");
    if (type === "task") {
      bindTaskDateAutofill();
    }
    if (type === "incomingItem") {
      byId("formFields").insertAdjacentHTML("beforeend", renderHuEditor(item));
      bindHuEditor();
    }
    dialog.showModal();
  }

  function bindTaskDateAutofill() {
    const levelInput = byId("level");
    const startInput = byId("startDate");
    const endInput = byId("endDate");
    let lastAutoEndDate = calculateEndDate(startInput.value, levelInput.value);
    if (!endInput.value) {
      endInput.value = lastAutoEndDate;
    }
    endInput.dataset.manual = endInput.value && endInput.value !== lastAutoEndDate ? "true" : "false";
    const refreshEndDate = () => {
      const nextAutoEndDate = calculateEndDate(startInput.value, levelInput.value);
      if (endInput.dataset.manual !== "true" || endInput.value === lastAutoEndDate) {
        endInput.value = nextAutoEndDate;
        endInput.dataset.manual = "false";
      }
      lastAutoEndDate = nextAutoEndDate;
    };
    levelInput.addEventListener("change", refreshEndDate);
    startInput.addEventListener("change", refreshEndDate);
    endInput.addEventListener("input", () => {
      endInput.dataset.manual = "true";
    });
  }

  function renderField(field, item) {
    const [name, label, type, size, options] = field;
    const value = item[name] ?? "";
    const fullClass = size === "full" ? " full" : "";
    if (type === "textarea") {
      return `
        <div class="field${fullClass}">
          <label for="${name}">${label}</label>
          <textarea id="${name}" name="${name}">${escapeHtml(value)}</textarea>
        </div>
      `;
    }
    if (type === "select") {
      const values = typeof options === "function" ? options() : options;
      return `
        <div class="field${fullClass}">
          <label for="${name}">${label}</label>
          <select id="${name}" name="${name}">
            ${values
              .map((option) => {
                const optionValue = Array.isArray(option) ? option[0] : option;
                const optionLabel = Array.isArray(option) ? option[1] : option;
                return `<option value="${escapeAttr(optionValue)}" ${optionValue === value ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`;
              })
              .join("")}
          </select>
        </div>
      `;
    }
    return `
      <div class="field${fullClass}">
        <label for="${name}">${label}</label>
        <input id="${name}" name="${name}" type="${type}" value="${escapeAttr(value)}" />
      </div>
    `;
  }

  function renderHuEditor(item) {
    const batches = state.incomingBatches.filter((batch) => batch.itemId === item.id);
    const rows = batches.length
      ? batches
      : [
          {
            id: "",
            huNo: "",
            qty: 0,
            location: "",
            result: "待检",
            inspector: "",
            inspectionDate: "",
            defectDesc: "",
          },
        ];
    return `
      <div class="field full hu-editor">
        <div class="hu-editor-header">
          <label>HU明细</label>
          <button class="button secondary compact" id="addHuRowBtn" type="button">＋</button>
        </div>
        <div class="hu-editor-rows" id="huEditorRows">
          ${rows.map(huEditorRow).join("")}
        </div>
      </div>
    `;
  }

  function huEditorRow(batch = {}) {
    const id = escapeAttr(batch.id || "");
    return `
      <div class="hu-editor-row" data-id="${id}">
        <div class="field">
          <label>HU号</label>
          <input data-hu-field="huNo" type="text" value="${escapeAttr(batch.huNo || "")}" />
        </div>
        <div class="field">
          <label>数量</label>
          <input data-hu-field="qty" type="number" min="0" value="${escapeAttr(batch.qty || 0)}" />
        </div>
        <div class="field">
          <label>库位</label>
          <input data-hu-field="location" type="text" value="${escapeAttr(batch.location || "")}" />
        </div>
        <div class="field">
          <label>结果</label>
          <select data-hu-field="result">
            ${["待检", "合格", "不合格", "待判定"].map((value) => `<option value="${value}" ${value === (batch.result || "待检") ? "selected" : ""}>${value}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>检验员</label>
          <input data-hu-field="inspector" type="text" value="${escapeAttr(batch.inspector || "")}" />
        </div>
        <div class="field">
          <label>检验日期</label>
          <input data-hu-field="inspectionDate" type="date" value="${escapeAttr(batch.inspectionDate || "")}" />
        </div>
        <div class="field">
          <label>异常说明</label>
          <input data-hu-field="defectDesc" type="text" value="${escapeAttr(batch.defectDesc || "")}" />
        </div>
        <button class="icon-button hu-remove-btn" type="button" aria-label="删除HU">×</button>
      </div>
    `;
  }

  function bindHuEditor() {
    byId("addHuRowBtn").addEventListener("click", () => {
      byId("huEditorRows").insertAdjacentHTML("beforeend", huEditorRow());
    });
    byId("huEditorRows").addEventListener("click", (event) => {
      const button = event.target.closest(".hu-remove-btn");
      if (!button) return;
      const rows = Array.from(document.querySelectorAll(".hu-editor-row"));
      if (rows.length <= 1) {
        button.closest(".hu-editor-row").querySelectorAll("input").forEach((input) => {
          input.value = input.type === "number" ? "0" : "";
        });
        button.closest(".hu-editor-row").querySelector("[data-hu-field='result']").value = "待检";
        return;
      }
      button.closest(".hu-editor-row").remove();
    });
  }

  function saveIncomingHuRows(item) {
    const rows = Array.from(document.querySelectorAll(".hu-editor-row"));
    const nextBatches = [];
    rows.forEach((row, index) => {
      const value = (name) => row.querySelector(`[data-hu-field='${name}']`)?.value?.trim() || "";
      const huNo = value("huNo");
      const qty = toNumber(value("qty"));
      const location = value("location");
      const result = normalizeInspectionResult(value("result")) || "待检";
      const inspector = value("inspector");
      let inspectionDate = normalizeDate(value("inspectionDate"));
      const defectDesc = value("defectDesc");
      const hasContent = huNo || qty || location || inspector || inspectionDate || defectDesc || result !== "待检";
      if (!hasContent) return;
      if (result !== "待检" && !inspectionDate) {
        inspectionDate = today();
      }
      nextBatches.push({
        id: row.dataset.id || `INSP-BATCH-${Date.now()}-${index}`,
        itemId: item.id,
        arrivalDate: normalizeDate(item.grDate) || today(),
        huNo,
        qty,
        location,
        inspector,
        inspectionDate,
        result,
        defectDesc,
        action: result === "不合格" ? "冻结" : result === "合格" ? "放行" : "",
        note: "",
      });
    });
    state.incomingBatches = state.incomingBatches.filter((batch) => batch.itemId !== item.id).concat(nextBatches);
  }

  function saveEditor(event) {
    event.preventDefault();
    const formData = new FormData(byId("editorForm"));
    const item = findItem(editing.type, editing.id) || createEmpty(editing.type);
    fields[editing.type].forEach(([name, , type]) => {
      const rawValue = formData.get(name);
      item[name] = type === "number" ? Number(rawValue || 0) : String(rawValue || "");
    });
    if (editing.type === "task" && !item.endDate) {
      item.endDate = calculateEndDate(item.startDate, item.level);
    }

    const listName = collectionName(editing.type);
    const index = state[listName].findIndex((entry) => entry.id === item.id);
    if (index >= 0) {
      state[listName][index] = item;
    } else {
      state[listName].push(item);
    }

    if (editing.type === "record") {
      applyRecordResult(item);
    }
    if (editing.type === "incomingBatch" && item.result && item.result !== "待检" && !item.inspectionDate) {
      item.inspectionDate = today();
    }
    if (editing.type === "incomingItem") {
      saveIncomingHuRows(item);
    }

    saveState();
    byId("editorDialog").close();
    render();
  }

  function createEmpty(type) {
    if (type === "rule") {
      return {
        id: `rule-${Date.now()}`,
        level: "Level 新",
        risk: "",
        typical: "",
        cycle: "",
        method: "来料 100%全检",
        stopCondition: "周期满足 + 连续3批次合格",
        observeCycle: "每个原周期抽检1次",
        closeCondition: "连续3次观察抽检合格",
      };
    }
    if (type === "record") {
      return {
        id: `rec-${Date.now()}`,
        taskId: state.tasks[0]?.id || "",
        batch: "",
        stage: "全检",
        screeningDate: today(),
        qty: 0,
        defectQty: 0,
        sameIssue: "否",
        result: "合格",
        action: "放行",
        inspector: "来料",
        defectDesc: "",
      };
    }
    if (type === "incomingItem") {
      return {
        id: `INSP-ITEM-${Date.now()}`,
        partNumber: "",
        partName: "",
        supplier: "",
        grDate: today(),
        inspectionContent: "",
        ownerDepartment: "来料",
        status: "启用",
        note: "",
      };
    }
    if (type === "incomingBatch") {
      return {
        id: `INSP-BATCH-${Date.now()}`,
        itemId: state.incomingItems[0]?.id || "",
        arrivalDate: today(),
        huNo: "",
        qty: 0,
        location: "",
        inspector: "",
        inspectionDate: "",
        result: "待检",
        defectDesc: "",
        action: "",
        note: "",
      };
    }
    const level = state.rules[0]?.level || "Level 1";
    const startDate = today();
    return {
      id: nextTaskId(),
      source: "产线异常",
      materialCode: "",
      materialName: "",
      supplier: "",
      screeningContent: "",
      level,
      startDate,
      endDate: calculateEndDate(startDate, level),
      stage: status.fullCheck,
      paused: "否",
      owner: "来料",
      note: "",
    };
  }

  function applyRecordResult(record) {
    const task = state.tasks.find((entry) => entry.id === record.taskId);
    if (!task || task.stage === status.closed) {
      return;
    }
    if (record.sameIssue === "是" || record.result === "不合格") {
      task.stage = status.fullCheck;
      task.note = appendNote(task.note, `${record.screeningDate} 发现同类或不合格问题，周期重置。`);
      return;
    }
    const summary = taskSummary(task);
    if (task.stage === status.fullCheck && summary.passBatches >= 3) {
      task.stage = status.observe;
      task.note = appendNote(task.note, `${record.screeningDate} 连续3批合格，进入观察阶段。`);
    }
    if (task.stage === status.observe && summary.observePasses >= 3) {
      task.stage = status.closed;
      task.note = appendNote(task.note, `${record.screeningDate} 连续3次观察合格，任务关闭。`);
      if (!task.endDate) {
        task.endDate = record.screeningDate;
      }
    }
  }

  function taskSummary(task) {
    const records = state.records
      .filter((record) => record.taskId === task.id)
      .sort((a, b) => String(a.screeningDate).localeCompare(String(b.screeningDate)));
    const passBatches = countRecentPasses(records.filter((record) => record.stage === "全检"));
    const observePasses = countRecentPasses(records.filter((record) => record.stage === "观察抽检"));
    const latestRecord = records[records.length - 1];
    const latestHasIssue = latestRecord && (latestRecord.sameIssue === "是" || latestRecord.result === "不合格");
    let stage = task.stage;
    let advice = "继续按规则执行";

    if (task.paused === "是") {
      stage = status.paused;
      advice = "来料中断，周期暂停";
    } else if (stage === status.fullCheck && passBatches >= 3 && !latestHasIssue) {
      advice = "可停止全检，进入观察";
    } else if (stage === status.observe && observePasses >= 3 && !latestHasIssue) {
      advice = "可关闭任务，恢复正常检验";
    } else if (latestHasIssue) {
      advice = "周期重置，必要时升级等级";
    }
    const overdue = isOverdue({ ...task, stage });
    if (overdue) {
      advice = "已超过结束日期，请优先确认";
    }

    return {
      ...task,
      stage,
      overdue,
      passBatches,
      observePasses,
      advice,
    };
  }

  function isOverdue(task) {
    return Boolean(task.endDate && task.stage !== status.closed && task.stage !== status.paused && task.endDate < today());
  }

  function dateWithOverdue(task) {
    const dateText = escapeHtml(task.endDate || "待确认");
    return task.overdue ? `${dateText}<br><span class="badge overdue">超期</span>` : dateText;
  }

  function countRecentPasses(records) {
    let count = 0;
    for (let index = records.length - 1; index >= 0; index -= 1) {
      const record = records[index];
      if (record.sameIssue === "是" || record.result !== "合格") {
        break;
      }
      count += 1;
    }
    return count;
  }

  async function importTableFile(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const rows = file.name.toLowerCase().endsWith(".csv")
        ? parseCsv(await file.text())
        : await parseXlsx(file);
      const imported = type === "task" ? importTasks(rows) : importRecords(rows);
      saveState();
      render();
      renderDataStatus(`已从 ${file.name} 导入 ${imported} 条${typeName(type)}`);
      window.alert(`导入完成：${imported} 条${typeName(type)}`);
    } catch (error) {
      window.alert(`导入失败：${error.message}`);
    } finally {
      event.target.value = "";
    }
  }

  function importTasks(rows) {
    const objects = rowsToObjects(rows);
    let count = 0;
    objects.forEach((row) => {
      const level = valueByHeaders(row, ["风险等级", "等级", "Level"]) || "Level 1";
      const startDate = normalizeDate(valueByHeaders(row, ["启动日期", "开始日期", "StartDate"])) || today();
      const id = valueByHeaders(row, ["任务单号", "筛选任务单号", "TaskID"]) || nextTaskId(count);
      const task = {
        id,
        source: valueByHeaders(row, ["异常来源", "来源"]) || "产线异常",
        materialCode: valueByHeaders(row, ["零件号", "物料编码", "物料号", "料号"]) || "",
        materialName: valueByHeaders(row, ["物料名称", "品名"]) || "",
        supplier: valueByHeaders(row, ["供应商", "供应商名称"]) || "",
        screeningContent: valueByHeaders(row, ["筛选内容", "异常描述", "问题描述"]) || "",
        level,
        startDate,
        endDate: normalizeDate(valueByHeaders(row, ["结束日期", "预计结束日期", "EndDate"])) || calculateEndDate(startDate, level),
        stage: normalizeTaskStage(valueByHeaders(row, ["当前阶段", "阶段", "状态"])) || status.fullCheck,
        paused: normalizeYesNo(valueByHeaders(row, ["来料中断", "是否中断"])) || "否",
        owner: valueByHeaders(row, ["责任部门", "责任人", "执行方", "Owner"]) || "来料",
        note: valueByHeaders(row, ["备注", "说明"]) || "",
      };
      upsertById(state.tasks, task);
      count += 1;
    });
    return count;
  }

  function importRecords(rows) {
    const objects = rowsToObjects(rows);
    let count = 0;
    objects.forEach((row) => {
      const taskId = valueByHeaders(row, ["任务单号", "筛选任务单号", "TaskID"]);
      if (!taskId) {
        return;
      }
      const record = {
        id: valueByHeaders(row, ["记录ID", "ID"]) || `rec-${Date.now()}-${count}`,
        taskId,
        batch: valueByHeaders(row, ["来料批次", "批次", "批号"]) || "",
        stage: normalizeRecordStage(valueByHeaders(row, ["筛选阶段", "阶段"])) || "全检",
        screeningDate: normalizeDate(valueByHeaders(row, ["筛选日期", "检验日期", "日期"])) || today(),
        qty: toNumber(valueByHeaders(row, ["筛选数量", "检验数量", "数量"])),
        defectQty: toNumber(valueByHeaders(row, ["不良数量", "不良数"])),
        sameIssue: normalizeYesNo(valueByHeaders(row, ["是否同类不良", "同类不良"])) || "否",
        result: normalizeResult(valueByHeaders(row, ["判定结果", "判定", "结果"])) || "合格",
        action: valueByHeaders(row, ["处理方式", "处置方式"]) || "放行",
        inspector: valueByHeaders(row, ["检验员", "筛选人"]) || "来料",
        defectDesc: valueByHeaders(row, ["不良现象", "缺陷描述", "备注"]) || "",
      };
      upsertById(state.records, record);
      applyRecordResult(record);
      count += 1;
    });
    return count;
  }

  function rowsToObjects(rows) {
    const headerRowIndex = rows.findIndex((row) => row.some((cell) => String(cell || "").trim()));
    if (headerRowIndex < 0) return [];
    const headers = rows[headerRowIndex].map((cell) => String(cell || "").trim());
    return rows
      .slice(headerRowIndex + 1)
      .filter((row) => row.some((cell) => String(cell || "").trim()))
      .map((row) => {
        const object = {};
        headers.forEach((header, index) => {
          if (header) object[header] = row[index] ?? "";
        });
        return object;
      });
  }

  function valueByHeaders(row, names) {
    for (const name of names) {
      if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== "") {
        return String(row[name]).trim();
      }
    }
    return "";
  }

  function upsertById(list, item) {
    const index = list.findIndex((entry) => entry.id === item.id);
    if (index >= 0) {
      list[index] = item;
    } else {
      list.push(item);
    }
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") index += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }
    row.push(cell);
    rows.push(row);
    return rows;
  }

  async function parseXlsx(file) {
    const buffer = await file.arrayBuffer();
    const zip = readZipEntries(buffer);
    const sheetName = Object.keys(zip).find((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name));
    if (!sheetName) {
      throw new Error("未找到工作表，请确认文件为 .xlsx 格式。");
    }
    const sharedStrings = zip["xl/sharedStrings.xml"] ? parseSharedStrings(await entryText(zip["xl/sharedStrings.xml"])) : [];
    const sheetXml = await entryText(zip[sheetName]);
    return parseWorksheet(sheetXml, sharedStrings);
  }

  function readZipEntries(buffer) {
    const view = new DataView(buffer);
    let eocd = -1;
    for (let index = view.byteLength - 22; index >= 0; index -= 1) {
      if (view.getUint32(index, true) === 0x06054b50) {
        eocd = index;
        break;
      }
    }
    if (eocd < 0) throw new Error("无法读取 Excel 文件结构。");
    const entryCount = view.getUint16(eocd + 10, true);
    const centralOffset = view.getUint32(eocd + 16, true);
    const entries = {};
    let offset = centralOffset;
    for (let index = 0; index < entryCount; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) break;
      const compression = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const name = decodeBytes(new Uint8Array(buffer, offset + 46, nameLength));
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      entries[name] = {
        name,
        compression,
        data: new Uint8Array(buffer, dataStart, compressedSize),
      };
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  async function entryText(entry) {
    const bytes = entry.compression === 0 ? entry.data : await inflateRaw(entry.data);
    return decodeBytes(bytes);
  }

  async function inflateRaw(bytes) {
    if (!window.DecompressionStream) {
      throw new Error("当前浏览器不支持直接解析 .xlsx，可先将 Excel 另存为 CSV 后导入。");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function parseSharedStrings(xmlText) {
    const xml = new DOMParser().parseFromString(xmlText, "application/xml");
    return Array.from(xml.getElementsByTagName("si")).map((node) => node.textContent || "");
  }

  function parseWorksheet(xmlText, sharedStrings) {
    const xml = new DOMParser().parseFromString(xmlText, "application/xml");
    const rows = [];
    Array.from(xml.getElementsByTagName("row")).forEach((rowNode) => {
      const row = [];
      Array.from(rowNode.getElementsByTagName("c")).forEach((cellNode) => {
        const ref = cellNode.getAttribute("r") || "";
        const column = columnIndex(ref.replace(/\d+/g, ""));
        const type = cellNode.getAttribute("t");
        const valueNode = cellNode.getElementsByTagName("v")[0];
        const inlineNode = cellNode.getElementsByTagName("is")[0];
        let value = "";
        if (type === "s") {
          value = sharedStrings[Number(valueNode?.textContent || 0)] || "";
        } else if (type === "inlineStr") {
          value = inlineNode?.textContent || "";
        } else {
          value = valueNode?.textContent || "";
        }
        row[column] = value;
      });
      rows.push(row);
    });
    return rows.map((row) => row.map((cell) => cell ?? ""));
  }

  function columnIndex(columnRef) {
    let index = 0;
    for (const char of columnRef.toUpperCase()) {
      index = index * 26 + char.charCodeAt(0) - 64;
    }
    return Math.max(index - 1, 0);
  }

  function decodeBytes(bytes) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  function calculateEndDate(startDate, level) {
    return calculateEndDateWithRules(startDate, level, state.rules);
  }

  function calculateEndDateWithRules(startDate, level, rules) {
    if (!startDate) return "";
    const rule = rules.find((item) => item.level === level);
    const days = extractCycleDays(rule?.cycle || "");
    if (!days) return "";
    return addWorkdays(startDate, days);
  }

  function extractCycleDays(cycle) {
    const match = String(cycle).match(/(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  function addWorkdays(dateText, days) {
    const date = parseDate(dateText);
    if (!date || !days) return "";
    let added = 0;
    while (added < days) {
      date.setDate(date.getDate() + 1);
      const weekday = date.getDay();
      if (weekday !== 0 && weekday !== 6) {
        added += 1;
      }
    }
    return toDateInputValue(date);
  }

  function addCalendarDays(dateText, days) {
    const date = parseDate(dateText);
    if (!date) return "";
    date.setDate(date.getDate() + Number(days || 0));
    return toDateInputValue(date);
  }

  function normalizeState(input) {
    const clean = input && Array.isArray(input.rules) ? input : JSON.parse(JSON.stringify(defaultState));
    clean.rules = clean.rules?.length ? clean.rules : JSON.parse(JSON.stringify(defaultRules));
    clean.tasks = (clean.tasks || []).map((task) => {
      const normalized = {
        ...task,
        screeningContent: task.screeningContent || task.issue || "",
        startDate: normalizeDate(task.startDate) || today(),
        stage: normalizeTaskStage(task.stage) || status.fullCheck,
        paused: normalizeYesNo(task.paused) || "否",
      };
      delete normalized.concession;
      normalized.endDate = normalizeDate(task.endDate) || calculateEndDateWithRules(normalized.startDate, normalized.level, clean.rules);
      delete normalized.issue;
      return normalized;
    });
    clean.records = (clean.records || []).map((record) => ({
      ...record,
      stage: normalizeRecordStage(record.stage) || "全检",
      screeningDate: normalizeDate(record.screeningDate) || today(),
      qty: toNumber(record.qty),
      defectQty: toNumber(record.defectQty),
      sameIssue: normalizeYesNo(record.sameIssue) || "否",
      result: normalizeResult(record.result) || "合格",
    }));
    clean.incomingBatches = (clean.incomingBatches || []).map((batch) => ({
      ...batch,
      arrivalDate: normalizeDate(batch.arrivalDate || batch.grDate) || today(),
      inspectionDate: normalizeDate(batch.inspectionDate),
      qty: toNumber(batch.qty),
      result: normalizeInspectionResult(batch.result) || "待检",
    }));
    clean.incomingItems = (clean.incomingItems || []).map((item) => {
      const itemBatches = clean.incomingBatches.filter((batch) => batch.itemId === item.id);
      return {
        ...item,
        partNumber: item.partNumber || item.materialCode || "",
        partName: item.partName || item.materialName || "",
        grDate: normalizeDate(item.grDate || item.arrivalDate) || earliestIncomingBatchDate(itemBatches) || today(),
        ownerDepartment: item.ownerDepartment || item.owner || "来料",
        status: item.status === "关闭" ? "关闭" : "启用",
        inspectionContent: item.inspectionContent || "",
      };
    });
    return clean;
  }

  function normalizeTaskStage(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text.includes("关闭")) return status.closed;
    if (text.includes("观察")) return status.observe;
    if (text.includes("暂停")) return status.paused;
    if (text.includes("全检") || text.includes("筛选")) return status.fullCheck;
    return text;
  }

  function normalizeRecordStage(value) {
    const text = String(value || "").trim();
    if (text.includes("观察")) return "观察抽检";
    if (text.includes("补")) return "补检";
    if (text) return "全检";
    return "";
  }

  function normalizeResult(value) {
    const text = String(value || "").trim();
    if (text.includes("不") || text.toLowerCase() === "ng") return "不合格";
    if (text.includes("待")) return "待判定";
    if (text) return "合格";
    return "";
  }

  function normalizeInspectionResult(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text.includes("不") || text.toLowerCase() === "ng") return "不合格";
    if (text.includes("待判")) return "待判定";
    if (text.includes("合格") || text.toLowerCase() === "ok") return "合格";
    if (text.includes("待检")) return "待检";
    return text;
  }

  function normalizeYesNo(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return "";
    if (["是", "yes", "y", "true", "1"].includes(text)) return "是";
    return "否";
  }

  function normalizeDate(value) {
    if (!value) return "";
    const text = String(value).trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) {
      const [year, month, day] = text.split("-").map(Number);
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(text)) {
      return normalizeDate(text.replaceAll("/", "-"));
    }
    if (/^\d+(\.\d+)?$/.test(text)) {
      return excelSerialToDate(Number(text));
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? "" : toDateInputValue(date);
  }

  function excelSerialToDate(serial) {
    const date = new Date(Date.UTC(1899, 11, 30));
    date.setUTCDate(date.getUTCDate() + Math.floor(serial));
    return toDateInputValue(date);
  }

  function parseDate(value) {
    const normalized = normalizeDate(value);
    if (!normalized) return null;
    const [year, month, day] = normalized.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function toDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function findItem(type, id) {
    if (!id) return null;
    return state[collectionName(type)].find((item) => item.id === id);
  }

  function deleteItem(type, id) {
    if (!window.confirm(`确认删除这条${typeName(type)}吗？`)) {
      return;
    }
    const listName = collectionName(type);
    state[listName] = state[listName].filter((item) => item.id !== id);
    if (type === "task") {
      state.records = state.records.filter((record) => record.taskId !== id);
    }
    if (type === "incomingItem") {
      state.incomingBatches = state.incomingBatches.filter((batch) => batch.itemId !== id);
    }
    saveState();
    render();
  }

  function rowActions(type, id) {
    const itemArg = jsString(id);
    const detailButton =
      type === "task" ? `<button class="text-button" onclick="window.appDetail('${itemArg}')">详情</button>` : "";
    return `
      <div class="row-actions">
        ${detailButton}
        <button class="text-button" onclick="window.appEdit('${type}', '${itemArg}')">编辑</button>
        <button class="text-button danger" onclick="window.appDelete('${type}', '${itemArg}')">删除</button>
      </div>
    `;
  }

  function openDetail(id) {
    const rawTask = state.tasks.find((item) => item.id === id);
    if (!rawTask) return;
    const task = taskSummary(rawTask);
    detailTaskId = id;
    const rule = state.rules.find((item) => item.level === task.level);
    const records = state.records
      .filter((record) => record.taskId === task.id)
      .sort((a, b) => String(b.screeningDate).localeCompare(String(a.screeningDate)));
    byId("detailTitle").textContent = `任务详情：${task.id}`;
    byId("detailBody").innerHTML = `
      <div class="detail-section">
        <h4>基本信息</h4>
        <div class="detail-grid">
          ${detailItem("零件号", task.materialCode)}
          ${detailItem("物料名称", task.materialName)}
          ${detailItem("供应商", task.supplier)}
          ${detailItem("异常来源", task.source)}
          ${detailHtmlItem("风险等级", levelBadge(task.level))}
          ${detailHtmlItem("当前阶段", stageBadge(task.stage))}
          ${detailItem("启动日期", task.startDate)}
          ${detailHtmlItem("结束日期", task.overdue ? `${escapeHtml(task.endDate)} ${badgeText("超期", "overdue")}` : escapeHtml(task.endDate || "待确认"))}
          ${detailItem("责任部门", task.owner)}
        </div>
      </div>
      <div class="detail-section">
        <h4>筛选内容</h4>
        <div class="detail-item"><strong>${escapeHtml(task.screeningContent || "未填写")}</strong></div>
      </div>
      <div class="detail-section">
        <h4>周期规则</h4>
        <div class="detail-grid">
          ${detailItem("全检周期", rule?.cycle || "未匹配")}
          ${detailItem("筛选方式", rule?.method || "未匹配")}
          ${detailItem("停止条件", rule?.stopCondition || "未匹配")}
          ${detailItem("观察周期", rule?.observeCycle || "未匹配")}
          ${detailItem("关闭条件", rule?.closeCondition || "未匹配")}
          ${detailItem("当前建议", task.advice)}
        </div>
      </div>
      <div class="detail-section">
        <h4>筛选进度</h4>
        <div class="detail-grid">
          ${detailItem("连续合格批次", `${task.passBatches}/3`)}
          ${detailItem("观察合格次数", `${task.observePasses}/3`)}
          ${detailItem("来料中断", task.paused)}
        </div>
      </div>
      <div class="detail-section">
        <h4>每日筛选趋势</h4>
        ${detailDailyTable(dailySummaries(records))}
      </div>
      <div class="detail-section">
        <h4>最近筛选记录</h4>
        ${detailRecordTable(records)}
      </div>
      <div class="detail-section">
        <h4>备注</h4>
        <div class="detail-item"><strong>${escapeHtml(task.note || "无")}</strong></div>
      </div>
    `;
    byId("detailDialog").showModal();
  }

  function detailItem(label, value) {
    return `<div class="detail-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "未填写")}</strong></div>`;
  }

  function detailHtmlItem(label, value) {
    return `<div class="detail-item"><span>${escapeHtml(label)}</span><strong>${value || "未填写"}</strong></div>`;
  }

  function badgeText(text, className) {
    return `<span class="badge ${className}">${escapeHtml(text)}</span>`;
  }

  function detailRecordTable(records) {
    if (!records.length) {
      return `<div class="detail-item"><strong>暂无筛选记录</strong></div>`;
    }
    return `
      <div class="table-wrap">
        <table class="mini-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>批次</th>
              <th>阶段</th>
              <th>数量</th>
              <th>不良</th>
              <th>判定</th>
            </tr>
          </thead>
          <tbody>
            ${records
              .slice(0, 8)
              .map(
                (record) => `
              <tr>
                <td>${escapeHtml(record.screeningDate)}</td>
                <td>${escapeHtml(record.batch)}</td>
                <td>${escapeHtml(record.stage)}</td>
                <td>${formatNumber(record.qty)}</td>
                <td>${formatNumber(record.defectQty)}</td>
                <td>${resultBadge(record.result)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function detailDailyTable(summaries) {
    if (!summaries.length) {
      return `<div class="detail-item"><strong>暂无每日筛选数据</strong></div>`;
    }
    return `
      <div class="table-wrap">
        <table class="mini-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>筛选数</th>
              <th>不良数</th>
              <th>不良率</th>
            </tr>
          </thead>
          <tbody>
            ${summaries
              .slice(0, 10)
              .map(
                (item) => `
              <tr>
                <td>${escapeHtml(item.date)}</td>
                <td>${formatNumber(item.qty)}</td>
                <td>${formatNumber(item.defectQty)}</td>
                <td>${formatRate(item.defectRate)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function closeDetail() {
    byId("detailDialog").close();
    detailTaskId = null;
  }

  function editDetailTask() {
    const id = detailTaskId;
    closeDetail();
    if (id) openEditor("task", id);
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `来料筛选周期数据-${today()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplate(type) {
    const headers =
      type === "task"
        ? ["任务单号", "异常来源", "零件号", "物料名称", "供应商", "筛选内容", "风险等级", "启动日期", "结束日期", "当前阶段", "责任部门", "备注"]
        : ["任务单号", "来料批次", "筛选阶段", "筛选日期", "筛选数量", "不良数量", "是否同类不良", "判定结果", "处理方式", "检验员", "不良现象"];
    const example =
      type === "task"
        ? ["SCR-20260629-001", "产线异常", "MAT-001", "示例物料", "示例供应商", "外观磕碰筛选", "Level 4", today(), "", "全检中", "来料", "示例行，可删除"]
        : ["SCR-20260629-001", "LOT-001", "全检", today(), "100", "0", "否", "合格", "放行", "来料", ""];
    const csv = [headers, example].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = type === "task" ? "筛选任务导入模板.csv" : "筛选记录导入模板.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function csvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function importJson(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        state = normalizeState(imported);
        saveState();
        render();
        renderDataStatus(`已导入 JSON：${file.name}`);
      } catch (error) {
        window.alert(`导入失败：${error.message}`);
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  function resetData() {
    if (!window.confirm("确认恢复示例数据吗？当前浏览器本地数据会被覆盖。")) {
      return;
    }
    state = normalizeState(JSON.parse(JSON.stringify(defaultState)));
    saveState();
    render();
    renderDataStatus("已恢复示例数据");
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey);
      return stored ? JSON.parse(stored) : JSON.parse(JSON.stringify(defaultState));
    } catch (error) {
      return JSON.parse(JSON.stringify(defaultState));
    }
  }

  async function loadSharedState() {
    if (!isServerMode()) {
      return;
    }
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.state) {
        state = normalizeState(payload.state);
      }
    } catch (error) {
      console.warn("Shared state unavailable, using local state.", error);
    }
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
    if (isServerMode()) {
      saveSharedState();
    }
  }

  async function saveSharedState() {
    try {
      await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
    } catch (error) {
      console.warn("Shared state save failed.", error);
    }
  }

  function isServerMode() {
    if (window.SCREENING_FORCE_LOCAL) {
      return false;
    }
    return window.location.protocol === "http:" || window.location.protocol === "https:";
  }

  function dailySummaries(records) {
    const groups = new Map();
    records.forEach((record) => {
      const date = normalizeDate(record.screeningDate) || "未填写日期";
      if (!groups.has(date)) {
        groups.set(date, {
          date,
          qty: 0,
          defectQty: 0,
          taskIds: new Set(),
          batches: new Set(),
        });
      }
      const group = groups.get(date);
      group.qty += toNumber(record.qty);
      group.defectQty += toNumber(record.defectQty);
      if (record.taskId) group.taskIds.add(record.taskId);
      if (record.batch) group.batches.add(record.batch);
    });
    return Array.from(groups.values())
      .map((group) => ({
        date: group.date,
        qty: group.qty,
        defectQty: group.defectQty,
        defectRate: group.qty > 0 ? group.defectQty / group.qty : 0,
        taskCount: group.taskIds.size,
        batchCount: group.batches.size,
      }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function dailyProjectStats(date) {
    const rows = dailyTasksForDate(date);
    const defective = rows.filter((item) => item.defectQty > 0).length;
    return {
      total: rows.length,
      defective,
      rate: rows.length > 0 ? defective / rows.length : 0,
    };
  }

  function emptyDailySummary(date) {
    return {
      date,
      qty: 0,
      defectQty: 0,
      defectRate: 0,
      taskCount: 0,
      batchCount: 0,
    };
  }

  function totalQty() {
    return state.records.reduce((sum, record) => sum + Number(record.qty || 0), 0);
  }

  function totalDefects() {
    return state.records.reduce((sum, record) => sum + Number(record.defectQty || 0), 0);
  }

  function levelBadge(level) {
    const className = String(level).toLowerCase().replace(/\s+/g, "");
    return `<span class="badge ${className}">${escapeHtml(level)}</span>`;
  }

  function stageBadge(stage) {
    const map = {
      [status.fullCheck]: "full-check",
      [status.observe]: "observe",
      [status.paused]: "paused",
      [status.closed]: "closed",
    };
    return `<span class="badge ${map[stage] || ""}">${escapeHtml(stage)}</span>`;
  }

  function sameIssueBadge(value) {
    return value === "是"
      ? `<span class="badge fail">是</span>`
      : `<span class="badge pass">否</span>`;
  }

  function resultBadge(value) {
    const className = value === "合格" ? "pass" : value === "不合格" ? "fail" : "paused";
    return `<span class="badge ${className}">${escapeHtml(value)}</span>`;
  }

  function nextTaskId(offset = 0) {
    const date = today().replaceAll("-", "");
    const count = state.tasks.filter((task) => task.id.includes(date)).length + 1 + offset;
    return `SCR-${date}-${String(count).padStart(3, "0")}`;
  }

  function collectionName(type) {
    return { rule: "rules", task: "tasks", record: "records", incomingItem: "incomingItems", incomingBatch: "incomingBatches" }[type];
  }

  function typeName(type) {
    return { rule: "规则", task: "任务", record: "记录", incomingItem: "Q状态项目", incomingBatch: "到货HU记录" }[type];
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function toNumber(value) {
    const number = Number(String(value || "").replaceAll(",", ""));
    return Number.isFinite(number) ? number : 0;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("zh-CN");
  }

  function formatRate(value) {
    return `${(Number(value || 0) * 100).toFixed(1)}%`;
  }

  function appendNote(note, line) {
    return [note, line].filter(Boolean).join("\n");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function jsString(value) {
    return String(value ?? "")
      .replaceAll("\\", "\\\\")
      .replaceAll("'", "\\'")
      .replaceAll("\n", "\\n")
      .replaceAll("\r", "\\r");
  }

  function domId(value) {
    return encodeURIComponent(String(value ?? "")).replaceAll("%", "_");
  }

  window.appDailyInput = handleDailyInput;
  window.appSaveDaily = saveDailyRecord;
  window.appSelectProject = selectProject;
  window.appEdit = openEditor;
  window.appDelete = deleteItem;
  window.appDetail = openDetail;
})();
