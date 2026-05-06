const fs = require('fs');
const path = 'src/app/schedule/availability/[token]/SmartPollGrid.tsx';
let content = fs.readFileSync(path, 'utf8');

const returnStart = content.indexOf('  return (\n    <div className="space-y-5">');
const panelProgressStart = content.indexOf('      {/* ── Panel Progress', returnStart);
const deadlineStart = content.indexOf('      {/* ── Deadline Banner', panelProgressStart);
const myProgressStart = content.indexOf('      {/* ── My Progress', deadlineStart);
const returnEnd = content.indexOf('    </div>\n  );\n}', myProgressStart);

const panelProgress = content.slice(panelProgressStart, deadlineStart);
const leftColumnContent = content.slice(deadlineStart, myProgressStart);
const myProgress = content.slice(myProgressStart, returnEnd);

const newReturn = `  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* ── Left Column: Calendar ───────────────────────────────────────── */}
      <div className="lg:col-span-8 space-y-6">
${leftColumnContent}      </div>

      {/* ── Right Column: Command Center ─────────────────────────────────── */}
      <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
${panelProgress}${myProgress}      </div>
    </div>
  );
}`;

content = content.slice(0, returnStart) + newReturn + content.slice(returnEnd + 14);
fs.writeFileSync(path, content);
console.log("Done");
