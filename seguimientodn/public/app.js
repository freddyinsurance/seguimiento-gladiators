import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";



// Variables globales
let agents = [];
let charts = {};
let currentEditingRecord = null;

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    loadAgents();
    setDefaultDates();
    setupFormSubmit();
    setupEnterNavigation();
    setupNumberInputs();
    loadRecords();
});

// ==================== NAVEGACIÓN TABS ====================

function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;

            // Remover active de todos
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Activar el seleccionado
            btn.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');

            // Cargar datos según el tab
           // if (tabName === 'stats') {
           //     loadStats();
           // } else if (tabName === 'records') {
           //     loadRecords();
            //}
        });
    });
}

// ==================== AGENTES ====================

async function loadAgents() {
  try {
    showLoading('Cargando agentes...');

    // ✅ Sin query compuesta (evita índices)
    const snap = await getDocs(collection(window.db, "agents"));

    agents = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(a => a.active === true && a.name) // solo activos y con nombre
      .sort((a, b) => a.name.localeCompare(b.name)); // ordenar por nombre

    const agentSelect = document.getElementById('agent_name');
    agentSelect.innerHTML = '<option value="">Seleccione un agente...</option>';

    agents.forEach(agent => {
      const option = document.createElement('option');
      option.value = agent.name;
      option.textContent = agent.name;
      option.dataset.id = agent.id;
      agentSelect.appendChild(option);
    });

    const filterSelect = document.getElementById('filter-agent');
    filterSelect.innerHTML = '<option value="">Todos los agentes</option>';

    agents.forEach(agent => {
      const option = document.createElement('option');
      option.value = agent.name;
      option.textContent = agent.name;
      filterSelect.appendChild(option);
    });

  } catch (error) {
    console.error('Error cargando agentes:', error);
    showNotification('Error cargando agentes (mira Console)', 'error');
  } finally {
    hideLoading();
  }
}

// ==================== FORMULARIO ====================

function setDefaultDates() {
    // Obtener fecha local (sin problemas de zona horaria UTC)
    const today = getTodayLocal();

    // Configurar fecha del formulario con máximo = hoy
    const fechaInput = document.getElementById('fecha');
    fechaInput.value = today;
    fechaInput.setAttribute('max', today);

    // Agregar listener para validar en tiempo real
    fechaInput.addEventListener('change', function() {
        const selectedDate = new Date(this.value + 'T00:00:00');
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        if (selectedDate > todayDate) {
            showNotification('⚠️ No puedes seleccionar fechas futuras', 'error');
            this.value = today;
        }
    });

    document.getElementById('report-fecha-daily').value = today;

    // Fecha de inicio: hace 30 días
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    document.getElementById('stats-start-date').value = `${year}-${month}-${day}`;
    document.getElementById('stats-end-date').value = today;
}

// Función auxiliar para obtener la fecha local en formato YYYY-MM-DD
function getTodayLocal() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function setupFormSubmit() {
    const form = document.getElementById('daily-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const agentSelect = document.getElementById('agent_name');
        const selectedOption = agentSelect.options[agentSelect.selectedIndex];
        const agentId = selectedOption.dataset.id;

        // Validar que la fecha no sea futura
        const fechaSeleccionada = new Date(formData.get('fecha') + 'T00:00:00');
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        if (fechaSeleccionada > hoy) {
            showNotification('❌ No se pueden registrar fechas futuras. Solo hoy o fechas anteriores.', 'error');
            return;
        }

        const data = {
            fecha: formData.get('fecha'),
            agent_id: agentId,
            agent_name: formData.get('agent_name'),
            app: parseInt(formData.get('app')) || 0,
            press: parseInt(formData.get('press')) || 0,
            no_show: parseInt(formData.get('no_show')) || 0,
            ref: parseInt(formData.get('ref')) || 0,
            alp: parseFormattedNumber(formData.get('alp')),  // Solo ALP con decimales
            dia_sig: parseInt(formData.get('dia_sig')) || 0,
            no_califica: parseInt(formData.get('no_califica')) || 0,
            reschedule: parseInt(formData.get('reschedule')) || 0
        };

        try {
  showLoading('Guardando registro...');

const dupQ = query(
  collection(window.db, "records"),
  where("fecha", "==", data.fecha),
  where("agent_id", "==", data.agent_id)
);
const dupSnap = await getDocs(dupQ);
if (!dupSnap.empty) {
  showNotification('⚠️ Ya existe un registro para este agente en esta fecha. Ve a “Registros” y edítalo.', 'error');
  return;
}


  await addDoc(collection(window.db, "records"), {
    ...data,
    createdAt: new Date()
  });

  showNotification('✅ Registro guardado exitosamente', 'success');
  form.reset();
  setDefaultDates();
  loadRecords();
} catch (error) {
  console.error('Error:', error);
  showNotification('❌ Error al guardar el registro', 'error');
} finally {
  hideLoading();
}
});
}



// ==================== NAVEGACIÓN CON ENTER ====================

function setupEnterNavigation() {
    const form = document.getElementById('daily-form');
    const inputs = form.querySelectorAll('input[type="date"], select, input[type="number"], input[type="text"]');

    inputs.forEach((input, index) => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();

                // Buscar el siguiente campo que no esté deshabilitado
                const nextIndex = index + 1;
                if (nextIndex < inputs.length) {
                    inputs[nextIndex].focus();
                } else {
                    // Si es el último campo, enfocar el botón de guardar
                    const submitBtn = form.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.focus();
                    }
                }
            }
        });
    });
}

// ==================== FORMATEO DE INPUT ALP (DECIMAL) ====================

function setupNumberInputs() {
    // Obtener solo los inputs de ALP (con clase 'alp-input')
    const alpInputs = document.querySelectorAll('.alp-input');

    alpInputs.forEach(input => {
        // Formatear al perder el foco
        input.addEventListener('blur', function() {
            if (this.value) {
                const num = parseFormattedNumber(this.value);
                this.value = formatNumber(num);
            }
        });

        // Remover formato al enfocar para facilitar la edición
        input.addEventListener('focus', function() {
            if (this.value) {
                const num = parseFormattedNumber(this.value);
                this.value = num === 0 ? '' : num.toString();
            }
        });

        // Solo permitir números, punto y coma
        input.addEventListener('keypress', function(e) {
            const char = e.key;
            const currentValue = this.value;

            // Permitir: números, punto, coma, backspace, delete, tab, enter, flechas
            if (
                (char >= '0' && char <= '9') ||
                char === '.' ||
                char === ',' ||
                e.key === 'Backspace' ||
                e.key === 'Delete' ||
                e.key === 'Tab' ||
                e.key === 'Enter' ||
                e.key === 'ArrowLeft' ||
                e.key === 'ArrowRight'
            ) {
                // Permitir solo un punto decimal
                if (char === '.' && currentValue.includes('.')) {
                    e.preventDefault();
                }
                return true;
            }

            e.preventDefault();
            return false;
        });
    });
}

// ==================== REGISTROS ====================

async function loadRecords() {
  const fecha = document.getElementById('filter-fecha').value;
  const agentName = document.getElementById('filter-agent').value;

  try {
    showLoading('Cargando registros...');

    let q = query(collection(window.db, "records"), orderBy("fecha", "desc"));
    if (fecha) q = query(q, where("fecha", "==", fecha));
    if (agentName) q = query(q, where("agent_name", "==", agentName));

    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const tbody = document.getElementById('records-body');

    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" class="no-data">No hay registros disponibles</td></tr>';
      return;
    }

    tbody.innerHTML = records.map(record => `
      <tr>
        <td>${formatDate(record.fecha)}</td>
        <td><strong>${record.agent_name}</strong></td>
        <td>${parseInt(record.app) || 0}</td>
        <td>${parseInt(record.press) || 0}</td>
        <td>${parseInt(record.no_show) || 0}</td>
        <td>${parseInt(record.no_califica) || 0}</td>
        <td>${parseInt(record.reschedule) || 0}</td>
        <td>${parseInt(record.ref) || 0}</td>
        <td>${formatNumber(record.alp)}</td>
        <td>${parseInt(record.dia_sig) || 0}</td>
        <td>
          <button class="btn-edit" onclick='openEditModal(${JSON.stringify(record)})'>✏️ Editar</button>
          <button class="btn btn-danger" onclick="deleteRecord('${record.id}')">🗑️</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error cargando registros:', error);
    showNotification('Error cargando registros', 'error');
  } finally {
    hideLoading();
  }
}


async function deleteRecord(id) {
  if (!confirm('¿Está seguro de eliminar este registro?')) return;

  try {
    showLoading('Eliminando registro...');

    await deleteDoc(doc(window.db, "records", id));

    showNotification('✅ Registro eliminado', 'success');
    loadRecords();
  } catch (error) {
    console.error('Error:', error);
    showNotification('❌ Error al eliminar', 'error');
  } finally {
    hideLoading();
  }
}

function clearFilters() {
    document.getElementById('filter-fecha').value = '';
    document.getElementById('filter-agent').value = '';
    loadRecords();
}

// ==================== ESTADÍSTICAS ====================

async function loadStats() {
    const startDate = document.getElementById('stats-start-date').value;
    const endDate = document.getElementById('stats-end-date').value;

    try {
        showLoading('Cargando estadísticas...');

        // Cargar datos generales
        const generalResponse = await fetch(`${API_URL}/stats/general?start_date=${startDate}&end_date=${endDate}`);
        const generalStats = await generalResponse.json();

        // Cargar ranking
        const rankingResponse = await fetch(`${API_URL}/stats/ranking?start_date=${startDate}&end_date=${endDate}&metric=app`);
        const ranking = await rankingResponse.json();

        // Crear gráficas
        createMetricsChart(generalStats);
        createRankingChart(ranking);
        createAlpChart(ranking);
        createTrendChart(generalStats);
        createPressChart(ranking);
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        showNotification('Error cargando estadísticas', 'error');
    } finally {
        hideLoading();
    }
}

function createMetricsChart(data) {
    const totals = data.reduce((acc, day) => {
        acc.app += parseInt(day.total_app) || 0;
        acc.press += parseInt(day.total_press) || 0;
        acc.ref += parseInt(day.total_ref) || 0;
        acc.alp += parseInt(day.total_alp) || 0;
        return acc;
    }, { app: 0, press: 0, ref: 0, alp: 0 });

    const ctx = document.getElementById('metricsChart');
    if (charts.metrics) charts.metrics.destroy();

    charts.metrics = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Appointments', 'Presentaciones', 'Referidos', 'ALP'],
            datasets: [{
                label: 'Total',
                data: [totals.app, totals.press, totals.ref, totals.alp],
                backgroundColor: [
                    'rgba(37, 99, 235, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(139, 92, 246, 0.8)'
                ],
                borderColor: [
                    'rgb(37, 99, 235)',
                    'rgb(16, 185, 129)',
                    'rgb(245, 158, 11)',
                    'rgb(139, 92, 246)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        },
        plugins: [{
            id: 'customLabelsMetrics',
            afterDatasetsDraw: function(chart) {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((bar, index) => {
                        const data = Number(dataset.data[index]);
                        ctx.fillStyle = '#1e293b';
                        ctx.font = 'bold 14px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(data, bar.x, bar.y - 5);
                    });
                });
            }
        }]
    });
}

function createRankingChart(ranking) {
    const top10 = ranking.slice(0, 10);

    const ctx = document.getElementById('rankingChart');
    if (charts.ranking) charts.ranking.destroy();

    charts.ranking = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top10.map(r => r.agent_name),
            datasets: [{
                label: 'Appointments',
                data: top10.map(r => parseInt(r.total_app) || 0),
                backgroundColor: 'rgba(37, 99, 235, 0.8)',
                borderColor: 'rgb(37, 99, 235)',
                borderWidth: 2
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true }
            }
        },
        plugins: [{
            id: 'customLabels',
            afterDatasetsDraw: function(chart) {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((bar, index) => {
                        const data = Number(dataset.data[index]);
                        ctx.fillStyle = '#1e293b';
                        ctx.font = 'bold 12px sans-serif';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(data, bar.x + 5, bar.y);
                    });
                });
            }
        }]
    });
}

function createAlpChart(ranking) {
    const ctx = document.getElementById('alpChart');
    if (charts.alp) charts.alp.destroy();

    // Ordenar por ALP y tomar todos los agentes con ALP > 0
    const agentsWithAlp = ranking
        .filter(r => parseInt(r.total_alp) > 0)
        .sort((a, b) => parseInt(b.total_alp) - parseInt(a.total_alp));

    if (agentsWithAlp.length === 0) {
        // Mostrar mensaje si no hay datos
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        return;
    }

    charts.alp = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: agentsWithAlp.map(r => r.agent_name),
            datasets: [{
                label: 'ALP',
                data: agentsWithAlp.map(r => parseInt(r.total_alp) || 0),
                backgroundColor: 'rgba(139, 92, 246, 0.8)',
                borderColor: 'rgb(139, 92, 246)',
                borderWidth: 2
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Total ALP por Agente'
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        },
        plugins: [{
            id: 'customLabelsAlp',
            afterDatasetsDraw: function(chart) {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((bar, index) => {
                        const data = Number(dataset.data[index]);
                        ctx.fillStyle = '#1e293b';
                        ctx.font = 'bold 12px sans-serif';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(data, bar.x + 5, bar.y);
                    });
                });
            }
        }]
    });
}

function createTrendChart(data) {
    const ctx = document.getElementById('trendChart');
    if (charts.trend) charts.trend.destroy();

    charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => formatDate(d.fecha)),
            datasets: [
                {
                    label: 'Appointments',
                    data: data.map(d => parseInt(d.total_app) || 0),
                    borderColor: 'rgb(37, 99, 235)',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Presentaciones',
                    data: data.map(d => parseInt(d.total_press) || 0),
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true, position: 'top' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function createPressChart(ranking) {
    const ctx = document.getElementById('pressChart');
    if (charts.press) charts.press.destroy();

    const top10 = ranking.slice(0, 10);

    charts.press = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: top10.map(r => r.agent_name),
            datasets: [{
                data: top10.map(r => parseInt(r.total_press) || 0),
                backgroundColor: [
                    'rgba(37, 99, 235, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(236, 72, 153, 0.8)',
                    'rgba(14, 165, 233, 0.8)',
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(251, 146, 60, 0.8)',
                    'rgba(168, 85, 247, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'right'
                }
            }
        }
    });
}

// ==================== REPORTE ====================

function selectReportType(type) {
    const dailyOptions = document.getElementById('daily-report-options');
    const rangeOptions = document.getElementById('range-report-options');
    const buttons = document.querySelectorAll('.report-type-btn');

    buttons.forEach(btn => btn.classList.remove('active'));

    if (type === 'daily') {
        dailyOptions.classList.add('active');
        rangeOptions.classList.remove('active');
        buttons[0].classList.add('active');
    } else {
        dailyOptions.classList.remove('active');
        rangeOptions.classList.add('active');
        buttons[1].classList.add('active');
    }
}

async function generateDailyReport() {
    const fecha = document.getElementById('report-fecha-daily').value;

    if (!fecha) {
        showNotification('Por favor seleccione una fecha', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/records-by-date/${fecha}`);
        const records = await response.json();

        const tbody = document.getElementById('report-body');

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="no-data">No hay registros para esta fecha</td></tr>';
            return;
        }

        // Obtener todos los agentes para incluir los que no tienen registros
        const allAgents = [...new Set([...agents.map(a => a.name)])];
        const recordsMap = {};
        records.forEach(r => {
            recordsMap[r.agent_name] = r;
        });

        tbody.innerHTML = allAgents.map(agentName => {
            const record = recordsMap[agentName];
            if (record) {
                // Función auxiliar para colorear celda en rojo si es 0 o vacío
                const getCellStyle = (value) => {
                    return (!value || value === 0) ? 'background-color: #ef4444; color: #ffffff; font-weight: bold;' : '';
                };

                return `
                    <tr>
                        <td style="text-align: left; font-weight: bold;">${record.agent_name}</td>
                        <td style="${getCellStyle(record.app)}">${record.app || ''}</td>
                        <td style="${getCellStyle(record.press)}">${record.press || ''}</td>
                        <td style="${getCellStyle(record.no_show)}">${record.no_show || ''}</td>
                        <td style="${getCellStyle(record.no_califica)}">${record.no_califica || ''}</td>
                        <td style="${getCellStyle(record.reschedule)}">${record.reschedule || ''}</td>
                        <td style="${getCellStyle(record.ref)}">${record.ref || ''}</td>
                        <td style="${getCellStyle(record.alp)}">${record.alp ? formatNumber(record.alp) : ''}</td>
                        <td style="${getCellStyle(record.dia_sig)}">${record.dia_sig || ''}</td>
                    </tr>
                `;
            } else {
                // Si no hay registro, toda la fila en rojo
                return `
                    <tr>
                        <td style="text-align: left; font-weight: bold;">${agentName}</td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                    </tr>
                `;
            }
        }).join('');

        // Actualizar título del reporte con la fecha
        document.querySelector('.report-header h1').textContent = 'SEGUIMIENTO DIARIO - GLADIATOR\'S TEAM';
        document.getElementById('report-date-range').textContent = formatDate(fecha);

    } catch (error) {
        console.error('Error generando reporte:', error);
        showNotification('Error generando reporte', 'error');
    }
}

async function generateRangeReport() {
    const fechaDesde = document.getElementById('report-fecha-desde').value;
    const fechaHasta = document.getElementById('report-fecha-hasta').value;

    if (!fechaDesde || !fechaHasta) {
        showNotification('Por favor seleccione ambas fechas (Desde y Hasta)', 'error');
        return;
    }

    if (fechaDesde > fechaHasta) {
        showNotification('La fecha "Desde" no puede ser mayor que "Hasta"', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/records-range?desde=${fechaDesde}&hasta=${fechaHasta}`);
        const records = await response.json();

        const tbody = document.getElementById('report-body');

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="no-data">No hay registros para este rango de fechas</td></tr>';
            return;
        }

        // Obtener todos los agentes para incluir los que no tienen registros
        const allAgents = [...new Set([...agents.map(a => a.name)])];
        const recordsMap = {};
        records.forEach(r => {
            recordsMap[r.agent_name] = r;
        });

        tbody.innerHTML = allAgents.map(agentName => {
            const record = recordsMap[agentName];
            if (record) {
                // Función auxiliar para colorear celda en rojo si es 0 o vacío
                const getCellStyle = (value) => {
                    return (!value || value === 0) ? 'background-color: #ef4444; color: #ffffff; font-weight: bold;' : '';
                };

                return `
                    <tr>
                        <td style="text-align: left; font-weight: bold;">${record.agent_name}</td>
                        <td style="${getCellStyle(record.app)}">${record.app || ''}</td>
                        <td style="${getCellStyle(record.press)}">${record.press || ''}</td>
                        <td style="${getCellStyle(record.no_show)}">${record.no_show || ''}</td>
                        <td style="${getCellStyle(record.no_califica)}">${record.no_califica || ''}</td>
                        <td style="${getCellStyle(record.reschedule)}">${record.reschedule || ''}</td>
                        <td style="${getCellStyle(record.ref)}">${record.ref || ''}</td>
                        <td style="${getCellStyle(record.alp)}">${record.alp ? formatNumber(record.alp) : ''}</td>
                        <td style="${getCellStyle(record.dia_sig)}">${record.dia_sig || ''}</td>
                    </tr>
                `;
            } else {
                // Si no hay registro, toda la fila en rojo
                return `
                    <tr>
                        <td style="text-align: left; font-weight: bold;">${agentName}</td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                        <td style="background-color: #ef4444; color: #ffffff; font-weight: bold;"></td>
                    </tr>
                `;
            }
        }).join('');

        // Actualizar título del reporte con el rango de fechas
        document.querySelector('.report-header h1').textContent = 'SEGUIMIENTO DIARIO - GLADIATOR\'S TEAM';
        document.getElementById('report-date-range').textContent = `${formatDate(fechaDesde)} al ${formatDate(fechaHasta)}`;

    } catch (error) {
        console.error('Error generando reporte:', error);
        showNotification('Error generando reporte', 'error');
    }
}

function printReport() {
    window.print();
}

function exportToExcel() {
    const table = document.getElementById('report-table');

    // Determinar qué tipo de reporte está activo
    const isDailyActive = document.getElementById('daily-report-options').classList.contains('active');
    let filename;

    if (isDailyActive) {
        const fecha = document.getElementById('report-fecha-daily').value || 'sin-fecha';
        filename = `reporte_${fecha}.csv`;
    } else {
        const fechaDesde = document.getElementById('report-fecha-desde').value || 'sin-fecha';
        const fechaHasta = document.getElementById('report-fecha-hasta').value || 'sin-fecha';
        filename = `reporte_${fechaDesde}_al_${fechaHasta}.csv`;
    }

    let csv = [];
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
        const cols = row.querySelectorAll('td, th');
        const csvRow = [];
        cols.forEach(col => csvRow.push(col.textContent));
        csv.push(csvRow.join(','));
    });

    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);

    showNotification('✅ Reporte exportado exitosamente', 'success');
}

async function takeScreenshot() {
    const reportPreview = document.getElementById('report-preview');
    const reportActions = document.querySelector('.report-actions');
    const reportTableContainer = document.querySelector('.report-table-container');

    // Guardar estilos originales
    const originalOverflow = reportTableContainer.style.overflow;
    const originalMaxHeight = reportTableContainer.style.maxHeight;
    const originalMaxWidth = reportPreview.style.maxWidth;
    const originalMargin = reportPreview.style.margin;

    // Ocultar los botones temporalmente
    reportActions.style.display = 'none';

    // Remover límites para capturar todo el contenido
    reportTableContainer.style.overflow = 'visible';
    reportTableContainer.style.maxHeight = 'none';
    reportPreview.style.maxWidth = 'none';
    reportPreview.style.margin = '0';

    // Hacer scroll al inicio del reporte
    window.scrollTo(0, reportPreview.offsetTop - 100);

    // Pausa para que el DOM se actualice
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        // Tomar el screenshot usando html2canvas
        const canvas = await html2canvas(reportPreview, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            scrollY: -window.scrollY,
            scrollX: -window.scrollX,
            width: reportPreview.scrollWidth,
            height: reportPreview.scrollHeight,
            windowWidth: document.documentElement.scrollWidth,
            windowHeight: document.documentElement.scrollHeight
        });

        // Convertir a blob
        canvas.toBlob(async (blob) => {
            // Determinar qué tipo de reporte está activo
            const isDailyActive = document.getElementById('daily-report-options').classList.contains('active');
            let fecha;

            if (isDailyActive) {
                fecha = document.getElementById('report-fecha-daily').value || 'sin-fecha';
            } else {
                const fechaDesde = document.getElementById('report-fecha-desde').value || 'sin-fecha';
                const fechaHasta = document.getElementById('report-fecha-hasta').value || 'sin-fecha';
                fecha = `${fechaDesde}_al_${fechaHasta}`;
            }

            // Intentar usar Share API siempre (tanto móvil como desktop)
            if (navigator.share) {
                try {
                    const file = new File([blob], `reporte_gladiators_${fecha}.png`, {
                        type: 'image/png',
                        lastModified: Date.now()
                    });

                    // Intentar compartir directamente
                    await navigator.share({
                        title: 'Reporte Gladiator\'s Team',
                        text: `📊 Reporte del ${fecha.replace(/_al_/g, ' al ').replace(/_/g, '-')}`,
                        files: [file]
                    });

                    showNotification('✅ Compartido exitosamente', 'success');
                } catch (error) {
                    if (error.name === 'AbortError') {
                        // Usuario canceló
                        showNotification('ℹ️ Compartir cancelado', 'error');
                    } else {
                        // Error al compartir - descargar como fallback
                        console.error('Error al compartir:', error);
                        downloadImage(blob, fecha);
                        showNotification('📥 Imagen descargada', 'success');
                    }
                }
            } else {
                // Navegador no soporta Share API - descargar
                downloadImage(blob, fecha);
                showNotification('📥 Imagen descargada', 'success');
            }
        }, 'image/png');

    } catch (error) {
        console.error('Error al capturar imagen:', error);
        showNotification('❌ Error al capturar la imagen', 'error');
    } finally {
        // Restaurar todos los estilos originales
        reportActions.style.display = 'flex';
        reportTableContainer.style.overflow = originalOverflow;
        reportTableContainer.style.maxHeight = originalMaxHeight;
        reportPreview.style.maxWidth = originalMaxWidth;
        reportPreview.style.margin = originalMargin;
    }
}

function downloadImage(blob, fecha) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${fecha}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('✅ Imagen descargada exitosamente', 'success');
}

// ==================== LOADING ====================

function showLoading(message = 'Cargando...') {
    const overlay = document.getElementById('loading-overlay');
    const text = overlay.querySelector('.loading-text');
    text.textContent = message;
    overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('active');
}

// ==================== MODAL DE EDICIÓN ====================

function openEditModal(record) {
    currentEditingRecord = record;

    // Llenar formulario - solo ALP con formato, los demás como enteros
    document.getElementById('edit-id').value = record.id;
    document.getElementById('edit-fecha').value = formatDate(record.fecha);
    document.getElementById('edit-agent-name').value = record.agent_name;
    document.getElementById('edit-app').value = parseInt(record.app) || 0;
    document.getElementById('edit-press').value = parseInt(record.press) || 0;
    document.getElementById('edit-no-show').value = parseInt(record.no_show) || 0;
    document.getElementById('edit-ref').value = parseInt(record.ref) || 0;
    document.getElementById('edit-alp').value = formatNumber(record.alp || 0);  // Solo ALP formateado
    document.getElementById('edit-dia-sig').value = parseInt(record.dia_sig) || 0;
    document.getElementById('edit-no-califica').value = parseInt(record.no_califica) || 0;
    document.getElementById('edit-reschedule').value = parseInt(record.reschedule) || 0;

    // Mostrar modal
    document.getElementById('edit-modal').classList.add('active');

    // Re-aplicar listeners a los inputs del modal (solo ALP)
    setTimeout(() => {
        setupNumberInputs();
    }, 100);
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('active');
    currentEditingRecord = null;
}

async function saveEdit() {
    const id = document.getElementById('edit-id').value;

    const data = {
        app: parseInt(document.getElementById('edit-app').value) || 0,
        press: parseInt(document.getElementById('edit-press').value) || 0,
        no_show: parseInt(document.getElementById('edit-no-show').value) || 0,
        ref: parseInt(document.getElementById('edit-ref').value) || 0,
        alp: parseFormattedNumber(document.getElementById('edit-alp').value),  // Solo ALP con decimales
        dia_sig: parseInt(document.getElementById('edit-dia-sig').value) || 0,
        no_califica: parseInt(document.getElementById('edit-no-califica').value) || 0,
        reschedule: parseInt(document.getElementById('edit-reschedule').value) || 0
    };

    try {
  showLoading('Guardando cambios...');

  await updateDoc(doc(window.db, "records", id), data);

  showNotification('✅ Registro actualizado', 'success');
  closeEditModal();
  loadRecords();
} catch (error) {
  console.error('Error:', error);
  showNotification('❌ Error al actualizar el registro', 'error');
} finally {
  hideLoading();
}
}



// ==================== UTILIDADES ====================

function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Formatear número con comas para miles y punto para decimales
// Ejemplo: 1501.95 => "1,501.95"
function formatNumber(number) {
    if (number === null || number === undefined || number === '') return '0';

    const num = parseFloat(number);
    if (isNaN(num)) return '0';

    return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Parsear número desde formato con comas
// Ejemplo: "1,501.95" => 1501.95
function parseFormattedNumber(str) {
    if (!str) return 0;
    // Remover comas y convertir a número
    const cleaned = str.toString().replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;

    // Duración más larga para mensajes importantes
    const duration = message.length > 80 ? 6000 : 3000;

    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}
