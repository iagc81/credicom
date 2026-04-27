let charts = {};

function formatearMonto(input) {
    let v = input.value.replace(/\D/g, "");
    input.value = v ? new Intl.NumberFormat('es-PY').format(v) : "";
}

function getNum(id) {
    const el = document.getElementById(id);
    return el.type === 'text' ? parseFloat(el.value.replace(/\./g, "")) || 0 : parseFloat(el.value) || 0;
}

function calcularOperacion(pref) {
    const solicitado = getNum(`cap${pref}`);
    const tna = getNum(`tna${pref}`) / 100;
    const n = getNum(`plazo${pref}`);
    const comPct = getNum(`com${pref}`) / 100;
    const segPct = getNum(`seg${pref}`) / 100;
    const aplicarIva = document.getElementById(`hasIva${pref}`).checked;
    
    if (solicitado <= 0 || n <= 0 || tna <= 0) return null;

    const montoComision = solicitado * comPct;
    const capitalBase = solicitado + montoComision;
    const iM = tna / 12;
    const cuotaPura = (capitalBase * iM) / (1 - Math.pow(1 + iM, -n));
    
    let saldo = capitalBase;
    let tabla = [];
    let acum = { cap: 0, int: 0, iva: 0, seg: 0, total: 0 };

    for (let i = 1; i <= n; i++) {
        let intMes = saldo * iM;
        let capMes = (i === n) ? saldo : (cuotaPura - intMes);
        let ivaMes = aplicarIva ? intMes * 0.10 : 0;
        let segMes = saldo * segPct;
        let cuotaTotal = cuotaPura + ivaMes + segMes;

        tabla.push({
            mes: i,
            saldo: Math.round(saldo),
            capP: Math.round(capMes),
            intP: Math.round(intMes),
            ivaP: Math.round(ivaMes),
            segP: Math.round(segMes),
            total: Math.round(cuotaTotal)
        });

        acum.int += intMes;
        acum.iva += ivaMes;
        acum.seg += segMes;
        acum.cap += capMes;
        acum.total += cuotaTotal;
        saldo -= capMes;
    }
    return { 
        tabla, acum, solicitado, capitalBase, n, 
        aplicarIva, nombre: document.getElementById(`nombre${pref}`).value 
    };
}

function procesarCalculos() {
    const ids = ['A', 'B', 'C'];
    const entidades = ids.map(id => calcularOperacion(id)).filter(x => x);

    if (entidades.length < 3) return alert("Por favor complete los datos de las 3 entidades.");

    ids.forEach((p, index) => {
        const ent = entidades[index];
        document.getElementById(`resumen${p}`).style.display = 'block';
        
        // Actualización de textos de resumen
        document.getElementById(`cuota${p}`).innerText = ent.tabla[0].total.toLocaleString('es-PY') + " PYG";
        document.getElementById(`resInt${p}`).innerText = Math.round(ent.acum.int).toLocaleString('es-PY') + " PYG";
        document.getElementById(`total${p}`).innerText = Math.round(ent.acum.total).toLocaleString('es-PY') + " PYG";

        // Gráfico de Torta
        const canvasId = `chartPie${p}`;
        if (charts[canvasId]) charts[canvasId].destroy();
        charts[canvasId] = new Chart(document.getElementById(canvasId), {
            type: 'pie',
            data: {
                labels: ['Capital', 'Interés', 'IVA/Seguros'],
                datasets: [{
                    data: [ent.capitalBase, ent.acum.int, ent.acum.iva + ent.acum.seg],
                    backgroundColor: ['#0f172a', '#3b82f6', '#ef4444']
                }]
            },
            options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }
        });
    });

    // Gráfico Evolución
    document.getElementById('chartsArea').style.display = 'block';
    if (charts.line) charts.line.destroy();
    charts.line = new Chart(document.getElementById('chartEvolucion'), {
        type: 'line',
        data: {
            labels: Array.from({length: Math.max(...entidades.map(e => e.n))}, (_, i) => i + 1),
            datasets: entidades.map((ent, i) => ({
                label: ent.nombre,
                data: ent.tabla.map(t => t.total),
                borderColor: ['#3b82f6', '#ef4444', '#10b981'][i],
                tension: 0.3,
                fill: false
            }))
        },
        options: { maintainAspectRatio: false, plugins: { title: { display: true, text: 'Comparativa de Cuotas Mensuales' } } }
    });
}

function abrirReporteHTML() {
    const ids = ['A', 'B', 'C'];
    const data = ids.map(id => calcularOperacion(id));
    if (!data[0]) return alert("Primero ejecute los cálculos.");

    const win = window.open("", "_blank");
    win.document.write(`
        <html><head><title>Reporte Plan de Pagos</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 20px; background: #f1f5f9; }
            .tabs { display: flex; gap: 5px; margin-bottom: 20px; border-bottom: 2px solid #cbd5e1; }
            .tab-btn { padding: 12px 25px; cursor: pointer; background: #e2e8f0; border: none; border-radius: 8px 8px 0 0; font-weight: bold; }
            .tab-btn.active { background: #0f172a; color: white; }
            .tab-content { display: none; background: white; padding: 20px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .tab-content.active { display: block; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: right; }
            th { background: #f8fafc; }
            .total-row { background: #f1f5f9; font-weight: bold; }
        </style></head>
        <body>
            <h2>Desglose de Amortización</h2>
            <div class="tabs">${data.map((e, i) => `<button class="tab-btn ${i===0?'active':''}" onclick="showTab(${i})">${e.nombre}</button>`).join('')}</div>
            ${data.map((e, i) => `
                <div id="tab-${i}" class="tab-content ${i===0?'active':''}">
                    <p><b>IVA s/ Interés:</b> ${e.aplicarIva ? 'Aplicado (10%)' : 'No aplicado'} | <b>Capital Inicial:</b> ${e.solicitado.toLocaleString()} PYG</p>
                    <table>
                        <thead><tr><th>Mes</th><th>Saldo</th><th>Capital</th><th>Interés</th><th>IVA</th><th>Seguro</th><th>Cuota</th></tr></thead>
                        <tbody>
                            ${e.tabla.map(r => `<tr><td>${r.mes}</td><td>${r.saldo.toLocaleString()}</td><td>${r.capP.toLocaleString()}</td><td>${r.intP.toLocaleString()}</td><td>${r.ivaP.toLocaleString()}</td><td>${r.segP.toLocaleString()}</td><td><b>${r.total.toLocaleString()}</b></td></tr>`).join('')}
                            <tr class="total-row">
                                <td colspan="2">TOTALES</td>
                                <td>${Math.round(e.acum.cap).toLocaleString()}</td>
                                <td>${Math.round(e.acum.int).toLocaleString()}</td>
                                <td>${Math.round(e.acum.iva).toLocaleString()}</td>
                                <td>${Math.round(e.acum.seg).toLocaleString()}</td>
                                <td>${Math.round(e.acum.total).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `).join('')}
            <script>
                function showTab(idx) {
                    document.querySelectorAll('.tab-content, .tab-btn').forEach(el => el.classList.remove('active'));
                    document.getElementById('tab-' + idx).classList.add('active');
                    document.querySelectorAll('.tab-btn')[idx].classList.add('active');
                }
            </script>
        </body></html>
    `);
}