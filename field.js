// Fighter pages: makes the dots on "Fame against skill" clickable. The field is a shared image;
// this reads the fighters who have a page (/fighters/field.json, cached across pages) and lays an
// invisible target over each of their dots, in the overlay's own coordinates, with the name on
// hover. Without script the chart is the same picture, just not clickable.
(function () {
    var svg = document.querySelector('.fm-top');
    if (!svg || !window.fetch) return;
    var NS = 'http://www.w3.org/2000/svg';
    var W = 720, H = 380, L = 46, R = 20, T = 16, B = 40;
    var x0 = +svg.dataset.x0, x1 = +svg.dataset.x1, y0 = +svg.dataset.y0, y1 = +svg.dataset.y1, me = svg.dataset.me;
    var x = function (v) { return L + ((v - x0) / (x1 - x0)) * (W - L - R); };
    var y = function (v) { return T + (1 - (v - y0) / (y1 - y0)) * (H - T - B); };
    var hits = svg.querySelector('.fm-hits');
    var tip = document.createElementNS(NS, 'text');
    tip.setAttribute('class', 'ch-val fm-tip');
    fetch('/fighters/field.json').then(function (r) { return r.json(); }).then(function (pages) {
        pages.forEach(function (p) {
            if (p[2] === me) return;
            var a = document.createElementNS(NS, 'a');
            a.setAttribute('href', '/fighters/' + p[2] + '/');
            a.setAttribute('class', 'fm-hit');
            var c = document.createElementNS(NS, 'circle');
            c.setAttribute('cx', x(p[0]).toFixed(1)); c.setAttribute('cy', y(p[1]).toFixed(1)); c.setAttribute('r', '6');
            var label = document.createElementNS(NS, 'title'); label.textContent = p[3];
            c.appendChild(label); a.appendChild(c);
            a.addEventListener('mouseenter', function () {
                var cx = x(p[0]), right = cx > W - 200;
                tip.textContent = p[3];
                tip.setAttribute('x', (cx + (right ? -10 : 10)).toFixed(1));
                tip.setAttribute('y', (y(p[1]) - 8).toFixed(1));
                tip.setAttribute('text-anchor', right ? 'end' : 'start');
                svg.appendChild(tip);
            });
            a.addEventListener('mouseleave', function () { if (tip.parentNode) tip.parentNode.removeChild(tip); });
            hits.appendChild(a);
        });
    }).catch(function () {});
})();
