import re

with open('src/components/TicketsTab.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("(typeof status !== 'undefined' && (status === 0 || status >= 500))", "(typeof status !== 'undefined' && (Number(status) === 0 || Number(status) >= 500))")

with open('src/components/TicketsTab.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
