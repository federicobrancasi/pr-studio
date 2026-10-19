// The layout samples: one slide for every built-in layout, with made-up demo data about a fictional team (Contoso) that
// ships an offline mode for its to-do app. `prs deck samples` builds it; look at out/contact.png to pick layouts, and
// copy the fields of a sample when you use its layout. The numbers are invented: a real deck sources every number.
const DEMO = ['Made-up demo data'];
const STILL = name => `assets/${name}.png`;

const openers = {
	id: 'openers', number: '01', title: 'Openers and big ideas', short: 'Openers',
	slides: [
		{
			id: 'title', layout: 'title',
			eyebrow: 'Layout samples  \u00b7  pr-studio',
			title: 'Shipping offline mode',
			quote: 'How the Contoso Tasks team built it, checked it and shipped it',
			speaker: { initials: 'CT', name: 'Contoso Tasks team', role: 'made-up demo data' },
			pills: [{ text: 'Demo deck', tone: 'blue' }, { text: 'October 2026', tone: 'neutral', icon: 'calendar' }],
			card: { label: 'Today', rows: 'blocks' },
			notes: 'The title slide. card.rows: \'blocks\' lists the sections with their minutes, computed by the build.',
		},
		{
			id: 'agenda', layout: 'agenda', eyebrow: 'Today', title: 'Five parts, one feature',
			items: [
				{ number: '01', title: 'Why offline mode', sub: 'What users asked for', minutes: 3 },
				{ number: '02', title: 'How it works', sub: 'Sync, conflicts, storage', minutes: 5 },
				{ number: '03', title: 'What we chose', sub: 'And what we left out', minutes: 4 },
				{ number: '04', title: 'The numbers', sub: 'Beta results', minutes: 3 },
				{ number: '05', title: 'How we shipped it', sub: 'Code, review, release', minutes: 5 },
			],
			notes: 'An agenda: one row per part.',
		},
		{
			id: 'openers-divider', layout: 'section', number: '01',
			eyebrow: 'Part 1  \u00b7  Openers  \u00b7  5 minutes', title: 'Openers and big ideas',
			sub: 'One big sentence, one number, one quote: slides that set up the talk.',
			chips: [{ icon: 'quote', text: 'Statements and quotes' }, { icon: 'dataBar', text: 'Big numbers' }],
			notes: 'A section divider. The build fills in the part number and the minutes.',
		},
		{
			id: 'statement', layout: 'statement', eyebrow: 'The idea',
			text: 'Users don\u2019t care where the server is. {{blue|They care that their list is there.}}',
			chips: [{ icon: 'phone', text: 'On the train', tone: 'blue' }, { icon: 'cloud', text: 'No signal', tone: 'orange' }, { icon: 'checkmark', text: 'Still works', tone: 'green' }],
			notes: 'One big sentence, with one or two marked words.',
		},
		{
			id: 'hero', layout: 'hero', eyebrow: 'Why we built it', icon: 'phone', value: '1 in 3', tone: 'blue',
			label: 'support tickets were about losing edits without a connection', sub: 'beta survey', sources: DEMO,
			notes: 'One giant number or word.',
		},
		{
			id: 'quote', layout: 'quote', bg: 'blue', eyebrow: 'From the beta',
			text: 'I wrote my whole shopping list in the tunnel, and it was all still there when I got out.',
			who: { initials: 'AL', name: 'A beta tester', role: 'made-up demo quote' },
			notes: 'A quote, here on a blue page for rhythm. A real deck quotes real words, with a source.',
		},
		{
			id: 'counters', layout: 'counters', eyebrow: 'The beta', title: 'Three numbers from the beta',
			items: [
				{ value: '2,400', label: 'beta testers', sub: 'Android and iOS', tone: 'blue' },
				{ value: '98%', label: 'of edits synced', sub: 'within a minute of coming back online', tone: 'green' },
				{ value: '12', label: 'conflicts a day', sub: 'two people changed the same task', tone: 'orange' },
			],
			sources: DEMO, notes: 'One to three big numbers.',
		},
		{
			id: 'pillars', layout: 'pillars', eyebrow: 'The plan', title: 'Three things offline mode needs',
			items: [
				{ icon: 'database', title: 'Local storage', text: 'Lists live on the phone first.', example: 'A small database' },
				{ icon: 'sync', title: 'Sync', text: 'Edits go up once online.', example: 'A queue' },
				{ icon: 'merge', title: 'Conflicts', text: 'One rule for clashes.', example: 'Newest wins' },
			],
			notes: 'Two to four ideas side by side.',
		},
		{
			id: 'icons', layout: 'icons', eyebrow: 'In one line', title: 'Write, wait, sync',
			items: [
				{ icon: 'edit', title: 'Write', sub: 'on the phone', tone: 'blue' },
				{ icon: 'hourglass', title: 'Wait', sub: 'for a signal', tone: 'orange' },
				{ icon: 'sync', title: 'Sync', sub: 'in the background', tone: 'green' },
			],
			arrows: true, notes: 'Two to five big icons, a few words each.',
		},
		{
			id: 'venn', layout: 'venn', eyebrow: 'Who it is for', title: 'Where offline mode matters most',
			sets: [{ title: 'Travels a lot' }, { title: 'Shares lists' }, { title: 'Weak signal' }],
			center: { title: 'Offline users', icon: 'people' }, notes: 'Two or three overlapping circles.',
		},
	],
};

const processes = {
	id: 'processes', number: '02', title: 'Processes and flows', short: 'Processes',
	slides: [
		{
			id: 'processes-divider', layout: 'section', number: '02',
			eyebrow: 'Part 2  \u00b7  Processes  \u00b7  10 minutes', title: 'Processes and flows',
			sub: 'Stages, steps, messages and loops: how something moves from start to end.',
			chips: [{ icon: 'flowchart', text: 'Flows' }, { icon: 'repeat', text: 'Loops' }], tone: 'green',
			notes: 'A divider in another tone.',
		},
		{
			id: 'pipeline', layout: 'pipeline', eyebrow: 'How it works', title: 'An edit\u2019s way to the server',
			stages: [
				{ icon: 'edit', title: 'You edit', sub: 'Saved on the phone at once', tone: 'blue' },
				{ icon: 'list', title: 'It waits', sub: 'In a queue of edits', tone: 'orange' },
				{ icon: 'cloud', title: 'Back online', sub: 'The queue is sent', tone: 'purple' },
				{ icon: 'checkmark', title: 'Synced', sub: 'Every device sees it', tone: 'green', on: true },
			],
			loop: { from: 2, to: 1, label: 'retry if it fails' }, notes: 'Stages left to right, with a loop back.',
		},
		{
			id: 'steps', layout: 'steps', eyebrow: 'Try it', title: 'Test offline mode in four steps',
			steps: [
				{ title: 'Turn on flight mode' },
				{ title: 'Add three tasks' },
				{ title: 'Go online' },
				{ title: 'Open the web app' },
			],
			aside: { label: 'Copy-paste check', prompt: 'Test it offline, then online.' },
			notes: 'Numbered steps, with a card on the right.',
		},
		{
			id: 'sequence', layout: 'sequence', eyebrow: 'Under the hood', title: 'One edit, three parties',
			parties: [
				{ icon: 'phone', title: 'The phone', sub: 'the app', tone: 'blue' },
				{ icon: 'server', title: 'Sync service', sub: 'in the cloud', tone: 'purple' },
				{ icon: 'laptop', title: 'The web app', sub: 'another device', tone: 'green' },
			],
			steps: [
				{ from: 0, to: 1, text: 'Three queued edits' },
				{ from: 1, to: 0, text: 'Saved', reply: 'Next edit', replyTone: 'green' },
				{ from: 1, to: 2, text: 'Your list changed' },
			],
			notes: 'Messages between two to four parties.',
		},
		{
			id: 'journey', layout: 'journey', eyebrow: 'One task', title: 'A task travels from phone to laptop',
			nodes: [
				{ icon: 'phone', title: 'Phone', sub: 'Written offline' },
				{ icon: 'list', title: 'Queue', sub: 'Waits for a signal' },
				{ icon: 'cloud', title: 'Server', sub: 'Saved for good' },
				{ icon: 'laptop', title: 'Laptop', sub: 'Shows up there', result: 'synced', resultTone: 'green' },
			],
			hops: ['stored', 'sent', 'pushed'], packet: { text: 'Buy milk', icon: 'tasks' }, notes: 'One thing across three to five stops.',
		},
		{
			id: 'timeline', layout: 'timeline', eyebrow: 'How we got here', title: 'From idea to release in a quarter',
			items: [
				{ date: 'July', title: 'The idea', sub: 'Top request in the survey' },
				{ date: 'August', title: 'Prototype', sub: 'Local storage only' },
				{ date: 'September', title: 'Beta', sub: 'Sync and conflicts' },
				{ date: 'October', title: 'Release', sub: 'For everyone', now: true },
			],
			notes: 'Three to eight dates.',
		},
		{
			id: 'flow', layout: 'flow', eyebrow: 'Conflicts', title: 'What happens when two edits clash', cols: 4, rows: 2,
			nodes: [
				{ id: 'in', col: 0, row: 0, title: 'Edit arrives', icon: 'download', tone: 'blue' },
				{ id: 'q', col: 1, row: 0, title: 'Same task changed?', kind: 'decision' },
				{ id: 'save', col: 3, row: 0, title: 'Save it', icon: 'check', tone: 'green' },
				{ id: 'newest', col: 1, row: 1, title: 'Newest edit wins', sub: 'by the time it was made', icon: 'clock', tone: 'orange' },
				{ id: 'tell', col: 2, row: 1, title: 'Tell both people', sub: 'a small note in the app', icon: 'alert', tone: 'orange' },
			],
			edges: [
				{ from: 'in', to: 'q' },
				{ from: 'q', to: 'save', label: 'no', tone: 'green' },
				{ from: 'q', to: 'newest', label: 'yes', tone: 'orange' },
				{ from: 'newest', to: 'tell' },
				{ from: 'tell', to: 'save' },
			],
			notes: 'Boxes and arrows with a yes/no branch.',
		},
		{
			id: 'cycle', layout: 'cycle', eyebrow: 'Every release', title: 'Ship, listen, fix, repeat',
			steps: [
				{ icon: 'rocket', title: 'Ship' },
				{ icon: 'personFeedback', title: 'Read the feedback' },
				{ icon: 'bug', title: 'Pick the worst bug' },
				{ icon: 'wrench', title: 'Fix it' },
			],
			center: { title: 'every two weeks', icon: 'repeat' }, notes: 'A loop of three to six steps.',
		},
		{
			id: 'lanes', layout: 'lanes', eyebrow: 'Who does what', title: 'How a bug report becomes a fix',
			lanes: [{ id: 'people', title: 'People', icon: 'people', tone: 'green' }, { id: 'ai', title: 'AI', icon: 'bot', tone: 'purple' }],
			steps: [
				{ lane: 'people', icon: 'bug', title: 'A user reports it' },
				{ lane: 'ai', icon: 'search', title: 'A bot finds the cause' },
				{ lane: 'ai', icon: 'code', title: 'An agent drafts a fix' },
				{ lane: 'people', icon: 'checkmark', title: 'A person reviews it' },
				{ lane: null, icon: 'rocket', title: 'Next release' },
			],
			notes: 'Steps left to right in two or three lanes.',
		},
		{
			id: 'loop', layout: 'loop', eyebrow: 'Code review', title: 'The bot reviews first. A person decides.',
			zone: { from: 0, to: 1, label: 'The AI loop', tone: 'purple' },
			steps: [
				{ icon: 'person', title: 'You', sub: 'write the change', tone: 'blue' },
				{ icon: 'bot', title: 'A bot reviews', sub: 'and lists findings', tone: 'purple' },
				{ icon: 'people', title: 'A teammate reviews', tone: 'green' },
				{ icon: 'merge', title: 'Merged', tone: 'green', solid: true },
			],
			hops: ['pull request', 'no findings left', 'approves'],
			backs: [{ from: 1, to: 0, label: 'fix and push again', chips: [{ text: '1 High', tone: 'red' }, { text: '2 Medium', tone: 'yellow' }] }],
			notes: 'A loop that repeats until it is clean, then a person decides.',
		},
		{
			id: 'layers', layout: 'layers', eyebrow: 'The stack', title: 'Three layers keep your list safe',
			layers: [
				{ icon: 'phone', title: 'On the phone', sub: 'A copy of every list', tone: 'blue', chips: ['always'] },
				{ icon: 'cloud', title: 'In the cloud', sub: 'The copy devices sync to', tone: 'purple' },
				{ icon: 'history', title: 'Backups', sub: 'One a day', tone: 'green', callout: 'restores a list' },
			],
			notes: 'Two to five stacked bands.',
		},
	],
};

const choices = {
	id: 'choices', number: '03', title: 'Comparisons and choices', short: 'Choices',
	slides: [
		{
			id: 'choices-divider', layout: 'section', number: '03',
			eyebrow: 'Part 3  \u00b7  Choices  \u00b7  10 minutes', title: 'Comparisons and choices',
			sub: 'Before and after, options side by side, and where something sits on a scale.',
			chips: [{ icon: 'compare', text: 'Before and after' }, { icon: 'table', text: 'Tables' }], tone: 'purple',
			notes: 'A divider in purple.',
		},
		{
			id: 'split', layout: 'split', eyebrow: 'Writing the task', title: 'Brief the agent like a new colleague',
			left: { label: 'Vague', tone: 'red', icon: 'dismiss', prompt: 'make the app work offline', notes: ['Which parts?'] },
			right: { label: 'Briefed', tone: 'green', icon: 'checkmark', prompt: 'Queue edits offline, send them when back online. Newest edit wins.', notes: ['A rule for conflicts'] },
			verdict: { text: 'A better first try', tone: 'green', icon: 'sparkle' },
			notes: 'Before and after, or weak and strong.',
		},
		{
			id: 'matrix', layout: 'matrix', eyebrow: 'The options', title: 'Three ways to store lists on the phone',
			columns: [{ label: 'Option', width: '1.5fr' }, { label: 'Fast', width: '1fr' }, { label: 'Small', width: '1fr' }, { label: 'Easy to sync', width: '1fr' }],
			rows: [
				['Plain files', { ok: true, text: 'yes' }, { ok: true, text: 'yes' }, { ok: false, text: 'no' }],
				['Key-value store', { ok: true, text: 'yes' }, { ok: true, text: 'yes' }, { ok: false, text: 'partly' }],
				{ cells: ['Small database', { ok: true, text: 'yes' }, { ok: false, text: 'larger' }, { ok: true, text: 'yes' }], tone: 'green' },
			],
			note: 'We picked the small database.', notes: 'A table; tint the row that wins.',
		},
		{
			id: 'quad', layout: 'quad', eyebrow: 'Prioritizing', title: 'Which bugs to fix first',
			x: { label: 'Users who see it', low: 'few', high: 'many' },
			y: { label: 'How bad', low: 'annoying', high: 'loses data' },
			cells: [
				{ icon: 'eye', title: 'Fix soon', text: 'Rare, but loses work.', tone: 'orange' },
				{ icon: 'flash', title: 'Fix now', text: 'Many lose work.', tone: 'red' },
				{ icon: 'clock', title: 'Backlog', text: 'Rare and harmless.', tone: 'neutral' },
				{ icon: 'calendar', title: 'Next release', text: 'Common, harmless.', tone: 'blue' },
			],
			notes: 'A 2 by 2. No apostrophes in the vertical axis label.',
		},
		{
			id: 'spectrum', layout: 'spectrum', eyebrow: 'How often to sync', title: 'Not too often, not too rarely',
			left: { title: 'Every keystroke', text: 'Drains the battery', icon: 'flash', tone: 'orange' },
			right: { title: 'Once an hour', text: 'Lists look out of date', icon: 'hourglass', tone: 'orange' },
			zone: { from: 0.34, to: 0.62, title: 'Just right', text: 'A few seconds after the last edit' }, notes: 'A scale between two extremes.',
		},
		{
			id: 'targets', layout: 'targets', eyebrow: 'Writing the task', title: 'What a vague, a good and a tight task get you',
			items: [
				{ title: 'Too vague', prompt: '\u201cMake it work offline.\u201d', hits: 'scatter', verdict: 'it guesses', tone: 'orange' },
				{ title: 'Just right', prompt: '\u201cQueue edits; newest wins.\u201d', hits: 'center', verdict: 'what you meant', tone: 'green' },
				{ title: 'Too tight', prompt: 'A page on every function', hits: 'off', verdict: 'exact, but brittle', tone: 'orange' },
			],
			notes: 'Three dartboards.',
		},
		{
			id: 'corridors', layout: 'corridors', eyebrow: 'Writing the task', title: 'Three roads to the same goal',
			items: [
				{ kind: 'open', title: 'Too vague', prompt: '\u201cMake it work offline.\u201d', verdict: 'it wanders', tone: 'orange' },
				{ kind: 'rails', title: 'Just right', prompt: '\u201cQueue edits; newest wins.\u201d', verdict: 'its own way there', tone: 'green' },
				{ kind: 'tunnel', title: 'Too tight', prompt: 'A page on every function', verdict: 'stuck on your plan', tone: 'orange' },
			],
			notes: 'Three roads: no walls, walls with room, a tunnel.',
		},
		{
			id: 'sliders', layout: 'sliders', eyebrow: 'Settings', title: 'Two knobs we set, one we locked',
			rows: [
				{ label: 'Sync', left: { text: 'Only on Wi-Fi', icon: 'home' }, right: { text: 'Any network', icon: 'globe' }, at: 0.8, tone: 'blue', mark: 'default' },
				{ label: 'Backups', left: { text: 'Every day', icon: 'calendar' }, right: { text: 'Never', icon: 'dismiss' }, at: 0.06, tone: 'green', lock: true, mark: 'locked' },
			],
			notes: 'Settings drawn as sliders.',
		},
		{
			id: 'poll', layout: 'poll', eyebrow: 'Predict first', title: 'How long until an offline edit syncs?',
			lead: 'Added in a tunnel; then the signal is back.',
			options: [{ text: 'Seconds', correct: true }, { text: 'A minute' }, { text: 'After a restart' }],
			answer: '**Under 5 seconds** in the beta, for nearly every edit.', sources: DEMO,
			notes: 'Predict, then reveal: the answer gets its own page.',
		},
		{
			id: 'board', layout: 'board', eyebrow: 'Next steps', title: 'Now, next, later',
			columns: [
				{ title: 'Now', icon: 'flash', items: ['Fix the sync bug', { title: 'Write release notes', sub: 'for the store pages' }] },
				{ title: 'Next', icon: 'calendar', items: ['Offline search', 'Faster first sync'] },
				{ title: 'Later', icon: 'flag', items: ['Shared lists offline'] },
			],
			notes: 'Two to four columns of cards.',
		},
		{
			id: 'checklist', layout: 'checklist', eyebrow: 'Before the release', title: 'Four checks before it ships',
			items: [
				{ icon: 'phone', tone: 'blue', title: 'Works in flight mode', sub: 'Android and iOS' },
				{ icon: 'sync', tone: 'green', title: 'Syncs within seconds' },
				{ icon: 'merge', tone: 'orange', title: 'Conflicts tell both people' },
				{ icon: 'history', tone: 'purple', title: 'A backup restores a list' },
			],
			notes: 'Three to five rows.',
		},
		{
			id: 'tree', layout: 'tree', eyebrow: 'Writing the task', title: 'Your words cut what the agent may do',
			root: { label: 'You ask', text: '\u201cMake the app work offline\u201d' },
			branches: [
				{ text: 'Rewrite the app', cut: '\u201ckeep the code\u201d' },
				{ text: 'Change the design', cut: '\u201cno UI changes\u201d' },
				{ text: 'Queue the edits' },
				{ text: 'Store lists locally' },
			],
			cutLabel: 'Your words cut', keepLabel: 'Left open: it decides', notes: 'A request branching; some branches cut.',
		},
	],
};

const data = {
	id: 'data', number: '04', title: 'Numbers and systems', short: 'Numbers',
	slides: [
		{
			id: 'data-divider', layout: 'section', number: '04',
			eyebrow: 'Part 4  \u00b7  Numbers  \u00b7  5 minutes', title: 'Numbers and systems',
			sub: 'Charts, funnels, and pictures of who talks to whom.',
			chips: [{ icon: 'chart', text: 'Charts' }, { icon: 'organization', text: 'Systems' }], tone: 'orange',
			notes: 'A divider in orange.',
		},
		{
			id: 'bars', layout: 'bars', eyebrow: 'The beta', title: 'Lost edits fell week by week', unit: '%', max: 10,
			bars: [{ label: 'Week 1', value: 8.2 }, { label: 'Week 2', value: 4.1 }, { label: 'Week 3', value: 1.6 }, { label: 'Week 4', value: 0.4, on: true }],
			note: 'Share of offline edits that never reached the server.', sources: DEMO, notes: 'A bar chart; highlight the bar that matters.',
		},
		{
			id: 'funnel', layout: 'funnel', eyebrow: 'The beta', title: 'From invite to daily use',
			stages: [{ value: '5,000', label: 'people invited' }, { value: '2,400', label: 'installed the beta' }, { value: '1,100', label: 'used it offline every day', tone: 'green' }],
			sources: DEMO, notes: 'Narrowing stages with numbers.',
		},
		{
			id: 'fan', layout: 'fan', eyebrow: 'One source', title: 'Written once, read by every client',
			inputs: [{ icon: 'documentText', title: '`sync-rules.md`', sub: 'the conflict rule', tone: 'blue' }, { icon: 'code', title: 'Shared code', sub: 'one library', tone: 'green' }],
			hub: { icon: 'server' },
			readers: [{ icon: 'phone', title: 'Android' }, { icon: 'phone', title: 'iOS' }, { icon: 'globe', title: 'Web' }, { icon: 'desktop', title: 'Desktop' }],
			notes: 'Inputs into a hub, read by many.',
		},
		{
			id: 'hub', layout: 'hub', eyebrow: 'Debugging', title: 'The agent fetches what it needs',
			ask: '\u201cWhy did this edit not sync?\u201d', center: { icon: 'bot', title: 'The agent' }, path: ['logs', 'code', 'test'],
			groups: [
				{ title: 'Read', tone: 'blue', items: [{ id: 'logs', icon: 'documentText', title: 'The sync logs' }, { id: 'code', icon: 'code', title: 'The queue code' }] },
				{ title: 'Run', tone: 'green', items: [{ id: 'test', icon: 'terminal', title: 'The offline tests' }, { id: 'sim', icon: 'phone', title: 'A phone simulator' }] },
				{ title: 'Ask', tone: 'purple', items: [{ id: 'issue', logo: 'github', title: 'The bug report' }] },
			],
			notes: 'A model in the middle with its tools, and a numbered path.',
		},
		{
			id: 'gate', layout: 'gate', eyebrow: 'The rule', title: 'Agents draft. One person ships.',
			zone: { label: 'Agents at work', tone: 'purple' },
			workers: [{ icon: 'bot', title: 'Sync fixes' }, { icon: 'bot', title: 'Tests' }, { icon: 'bot', title: 'Release notes' }],
			gate: { icon: 'person', title: 'The release owner', tone: 'green' }, exit: { icon: 'rocket', title: 'Shipped', tone: 'green' },
			bypass: { label: 'no way around' }, notes: 'Many work alone; one gate before the exit.',
		},
		{
			id: 'halves', layout: 'halves', eyebrow: 'Overnight', title: 'While you sleep, and when you wake up',
			left: { label: 'Overnight', icon: 'moon', title: 'Agents run the long tests', hero: ['bot', 'phone', 'sync'], dark: true },
			right: { label: 'In the morning', icon: 'sun', title: 'You read one summary', card: { icon: 'mail', text: 'All 214 offline tests passed' }, tone: 'green' },
			sources: DEMO, notes: 'Two halves of one idea, dark and light.',
		},
		{
			id: 'ways', layout: 'ways', eyebrow: 'Testing the app', title: 'Three ways an agent sees the app',
			ways: [
				{ pic: 'screen', title: 'A screenshot', pros: 'any app', cons: 'slow', tone: 'purple' },
				{ pic: 'tree', title: 'The app\u2019s tree', pros: 'exact', cons: 'needs help', tone: 'blue' },
				{ pic: 'both', title: 'Both', pros: 'reliable', cons: 'more work', tone: 'green' },
			],
			notes: 'One app, seen two or three ways.',
		},
		{
			id: 'runs', layout: 'runs', eyebrow: 'Every hour', title: 'A job that runs on a timer',
			task: 'The job: **sort new bug reports**', times: ['9:00', '10:00', '11:00'], run: 'fresh start', rw: 'reads, writes',
			memory: { file: 'NOTES.md', text: 'what is next' },
			sides: [{ icon: 'laptop', title: 'Local', tone: 'blue' }, { icon: 'cloud', title: 'Cloud', tone: 'purple' }],
			notes: 'The same job on a timer, with one notes file.',
		},
		{
			id: 'grid', layout: 'grid', eyebrow: 'What shipped', title: 'Six things in the release', cols: 3,
			items: [
				{ icon: 'phone', title: 'Offline lists', text: 'No signal needed' },
				{ icon: 'sync', title: 'Background sync', text: 'On its own' },
				{ icon: 'merge', title: 'Conflict notes', text: 'Both people see it' },
				{ icon: 'history', title: 'Daily backups', text: 'Restore a list' },
				{ icon: 'search', title: 'Offline search', text: 'Find any task' },
				{ icon: 'settings', title: 'Wi-Fi only', text: 'Save data' },
			],
			notes: 'Four to eight small cards.',
		},
	],
};

const stories = {
	id: 'stories', number: '05', title: 'Code, screens and stories', short: 'Stories',
	slides: [
		{
			id: 'stories-divider', layout: 'section', number: '05',
			eyebrow: 'Part 5  \u00b7  Stories  \u00b7  15 minutes', title: 'Code, screens and stories',
			sub: 'Code, terminals, chats, pictures, and what happened, in order.',
			chips: [{ icon: 'code', text: 'Code and terminals' }, { icon: 'history', text: 'Stories' }], tone: 'blue',
			notes: 'A divider in blue.',
		},
		{
			id: 'code', layout: 'code', annotate: true, eyebrow: 'The conflict rule', title: 'The rule fits in six lines', lang: 'ts', file: 'src/sync/merge.ts',
			code: 'function merge(mine: Task, theirs: Task) {\n\tif (mine.at === theirs.at) {\n\t\treturn theirs;\n\t}\n\treturn mine.at > theirs.at ? mine : theirs;\n}',
			callouts: [{ lines: [2, 3], title: 'A tie', text: 'the server\u2019s copy wins' }, { lines: [5, 5], title: 'Otherwise', text: 'the newest edit wins' }],
			notes: 'Code with notes joined to its lines.',
		},
		{
			id: 'terminal', layout: 'terminal', eyebrow: 'Checking it', title: 'Run the offline tests', window: 'Terminal: contoso-tasks',
			lines: [
				{ comment: 'The tests turn the network off and on' },
				{ cmd: 'npm run test:offline' },
				{ out: 'queue keeps edits while offline: passed', tone: 'green' },
				{ out: 'newest edit wins a conflict: passed', tone: 'green' },
			],
			notes: 'A terminal with commands and output.',
		},
		{
			id: 'chat', layout: 'chat', eyebrow: 'Working with an agent', title: 'It says what it changed, and why', dark: true, window: 'Chat',
			messages: [
				{ from: 'user', text: 'Offline edits sometimes vanish. Why?' },
				{ from: 'agent', text: 'The queue was cleared too early. It now waits for **saved**, with a test.' },
			],
			notes: 'A conversation, light or dark.',
		},
		{
			id: 'ui', layout: 'ui', eyebrow: 'Working with an agent', title: 'You approve the risky step',
			window: { title: 'Chat', width: 1000, blocks: [
				{ kind: 'user', text: 'Add a database migration' },
				{ kind: 'tool', icon: 'edit', text: 'Edited migrate.ts  +31 \u22122', status: 'done' },
				{ kind: 'approve', text: 'Run this command?', cmd: 'npm run migrate', buttons: ['Allow', 'Skip'] },
			] },
			callouts: [{ title: 'Reading is free' }, { title: 'Commands ask first', tone: 'orange' }],
			notes: 'A mock chat window with tool calls and an approval.',
		},
		{
			id: 'files', layout: 'files', eyebrow: 'The code', title: 'Where offline mode lives', root: 'contoso-tasks',
			items: [
				{ path: 'src/storage/', title: 'Local database', text: 'every list, on the device', icon: 'database', tone: 'blue' },
				{ path: 'src/sync/queue.ts', title: 'The edit queue', text: 'waits for a signal', icon: 'list', tone: 'orange' },
				{ path: 'src/sync/merge.ts', title: 'The conflict rule', text: 'newest edit wins', icon: 'merge', tone: 'green' },
				{ path: 'test/' },
			],
			notes: 'A folder tree with explained files.',
		},
		{
			id: 'image', layout: 'image', eyebrow: 'A picture', title: 'A screenshot: crop, pin, ring', src: STILL('code.diff'), alt: 'A code diff', crop: [44, 114, 592, 230], width: 1060,
			callouts: [{ title: 'Crop it', text: 'Only the part people need.' }, { title: 'Pin it', text: 'A number beside the spot.', at: [282, 205] }, { title: 'Ring it', text: 'A region, outlined.', box: [118, 288, 292, 16] }],
			notes: 'A screenshot from the deck\u2019s assets, cropped, with a callout pinned where it points (at: [x, y]) and one ringing a region (box: [x, y, w, h]), in the picture\u2019s own pixels.',
		},
		{
			id: 'spans', layout: 'spans', eyebrow: 'A lifecycle', title: 'Offline edits outlive the connection',
			moments: [{ title: 'Edit offline' }, { title: 'Back online', sub: 'the queue sends' }, { title: 'Server agrees' }, { title: 'App closes' }],
			rows: [
				{ title: 'Connection', tone: 'blue', bars: [{ from: 1, to: 3 }] },
				{ title: 'Queued edit', tone: 'orange', bars: [{ from: 0, to: 2, text: 'waits for the server' }] },
				{ title: 'Edit on screen', tone: 'green', bars: [{ from: 0, to: 3, text: 'shown all along', solid: true }] },
			],
			notes: 'What lives how long: a row per piece of state, a bar while it holds, between a few moments.', nosrc: true,
		},
		{
			id: 'split-pictures', layout: 'split', eyebrow: 'Before and after', title: 'Two crops of one screen, ringed',
			left: { label: 'Before', tone: 'red', icon: 'dismiss', title: 'Checked after the read', image: STILL('code.diff'), crop: [44, 114, 380, 230], box: [118, 197, 112, 16] },
			right: { label: 'After', tone: 'green', icon: 'checkmark', title: 'Checked first', image: STILL('code.diff'), crop: [44, 114, 380, 230], box: [118, 212, 246, 16] },
			verdict: { text: 'Crop both the same, ring what changed', tone: 'blue', icon: 'info' },
			notes: 'A split side can hold a picture: crop the before and after screenshots to the same region, and ring what changed (box: [x, y, w, h] in the picture\u2019s own pixels).',
		},
		{
			id: 'media', layout: 'media', eyebrow: 'Pictures', title: 'Up to six pictures with captions',
			items: [
				{ src: STILL('title.frame'), kind: 'video', caption: 'A video' },
				{ src: STILL('flow.pipeline'), kind: 'image', caption: 'A diagram' },
				{ src: STILL('status.board'), kind: 'website', caption: 'A web page' },
			],
			notes: 'One to six pictures, or stacks of strips.',
		},
		{
			id: 'posts', layout: 'posts', eyebrow: 'What people said', title: 'Two posts from the beta',
			posts: [
				{ platform: 'blog', author: 'Contoso blog', initials: 'CT', date: '2 Oct', text: 'Offline mode is here.', metrics: [{ icon: 'heart', text: '312' }] },
				{ platform: 'reddit', author: 'a tester', initials: 'BT', date: '28 Sep', text: 'Finally works on the underground.', metrics: [{ icon: 'arrowUp', text: '88' }] },
			],
			sources: DEMO, notes: 'Posts drawn as cards in this look. These are made up; a real deck draws real posts, with a source.',
		},
		{
			id: 'howto', layout: 'howto', eyebrow: 'For new users', title: 'Turn on offline mode',
			steps: [
				{ title: 'Open the commands', ui: { keys: ['F1'], alts: [{ label: 'Mac', keys: ['\u21e7', '\u2318', 'P'] }] } },
				{ title: 'Find the setting', ui: { palette: 'offline', items: ['Tasks: Turn On Offline Mode'] } },
				{ title: 'Pick your lists', tone: 'green', ui: { prompt: 'Which lists should work offline?', list: ['All lists', 'Only starred lists'], pick: 0 } },
			],
			note: 'Then go offline and try it', notes: 'How to do it in an app, with keys and small screens.',
		},
		{
			id: 'transform', layout: 'transform', eyebrow: 'Release notes', title: 'Notes in, clean release notes out',
			from: { icon: 'notepad', label: 'Team notes', text: 'sync ~~ok i think~~ works offline ~~mostly~~' },
			via: { icon: 'sparkle', label: 'An agent' },
			to: { icon: 'documentText', label: 'Release notes', text: 'Your lists now work offline.' },
			notes: 'Raw in, clean out, with what cleans it in the middle.',
		},
		{
			id: 'interview', layout: 'interview', eyebrow: 'Planning', title: 'Let the agent interview you first',
			ask: 'Plan offline search. **Interview me first.**',
			qa: [
				{ q: 'All lists or one?', rec: 'all', a: 'All', spec: 'Every list' },
				{ q: 'Finished tasks too?', rec: 'no', a: 'No', spec: 'Open tasks only' },
			],
			spec: { file: 'SPEC.md', title: 'Offline search' }, notes: 'Each answer adds a line to the spec.',
		},
		{
			id: 'brief', layout: 'brief', eyebrow: 'Plan first', title: 'You decide what. It decides how.',
			steps: ['Brainstorm', 'It writes the plan', 'You approve'],
			chat: [{ from: 'you', text: 'Lists must work offline.' }, { from: 'agent', text: 'Wait, or refuse edits?' }],
			doc: { file: 'PLAN.md', sections: [{ label: 'Goal', text: 'Works offline' }, { label: 'Steps', items: ['Queue', 'Tests'] }] },
			approve: { label: 'Approve, then build' },
			roles: { you: 'You decide what', agent: 'It decides how' }, notes: 'A brainstorm becomes a plan you approve.',
		},
		{
			id: 'mirror', layout: 'mirror', eyebrow: 'Porting', title: 'Copy it, compare it, until they match',
			prompt: '\u201cMatch the phone, screen by screen.\u201d',
			left: { title: 'Phone app', sub: 'the original', tone: 'blue' },
			right: { title: 'Web app', sub: 'the copy', tone: 'purple' },
			compare: 'compare', loop: 'fix, compare again',
			counter: { value: '3 days', label: 'until they matched' }, notes: 'An original and its copy, compared until they match.',
		},
		{
			id: 'story', layout: 'story', eyebrow: 'What happened  \u00b7  September 2026', title: 'A beta tester lost a shopping list',
			who: { icon: 'person', text: 'A beta tester on a long train ride' },
			beats: [
				{ time: 'The ride', icon: 'phone', text: 'Writes a list with no signal' },
				{ time: 'The bug', icon: 'bug', tone: 'red', text: 'The queue is cleared too early' },
				{ time: 'The fix', icon: 'wrench', tone: 'green', text: 'Clear it only after the server says saved' },
			],
			outcome: { label: 'Lists lost since', value: '0', text: 'in the rest of the beta' },
			sources: DEMO, notes: 'What happened, in three to five beats, with the outcome on the right.',
		},
		{
			id: 'story-road', layout: 'story', look: 'road', eyebrow: 'What happened  \u00b7  July to October', title: 'From a survey wish to a release',
			who: { icon: 'people', text: 'The Contoso Tasks team' },
			beats: [
				{ time: 'July', icon: 'personFeedback', text: 'Offline is the top wish' },
				{ time: 'August', icon: 'beaker', tone: 'purple', text: 'A prototype on one phone' },
				{ time: 'September', icon: 'people', tone: 'orange', text: 'A beta for testers' },
			],
			outcome: { label: 'October', value: 'Shipped', text: 'to everyone', tone: 'green' },
			notes: 'The road look: a change over time.',
		},
		{
			id: 'story-number', layout: 'story', look: 'number', eyebrow: 'What happened  \u00b7  the beta', title: 'The beta in one number',
			who: { icon: 'people', text: 'Beta testers' },
			beats: [
				{ time: 'Invited', icon: 'mail', text: 'Testers who asked for it' },
				{ time: 'Offline', icon: 'phone', text: 'Edits made with no signal' },
				{ time: 'Synced', icon: 'sync', tone: 'green', text: 'Once back online' },
				{ time: 'Lost', icon: 'warning', tone: 'red', text: 'Almost none, by week four' },
			],
			outcome: { label: 'Offline edits synced', value: '61k', text: 'in four weeks', tone: 'blue' },
			sources: DEMO, notes: 'The number look: one number in the middle.',
		},
		{
			id: 'story-panels', layout: 'story', look: 'panels', eyebrow: 'What happened  \u00b7  launch day', title: 'Launch day in three scenes',
			who: { icon: 'people', text: 'The Contoso Tasks team' },
			beats: [
				{ time: 'Morning', icon: 'rocket', text: 'Offline mode goes live' },
				{ time: 'Noon', icon: 'warning', tone: 'red', text: 'Sync slows down under load' },
				{ time: 'Evening', icon: 'wrench', tone: 'green', text: 'More servers, and it is fast again' },
			],
			outcome: { label: 'By night', value: 'Calm', text: 'and no lost edits', tone: 'green' },
			notes: 'The panels look: a comic strip.',
		},
		{
			id: 'story-split', layout: 'story', look: 'split', eyebrow: 'What happened  \u00b7  week two', title: 'One review caught the worst bug',
			who: { icon: 'person', text: 'A Contoso engineer' },
			before: 'Before the review', after: 'After the review',
			beats: [
				{ time: 'The change', icon: 'code', text: 'A faster sync queue' },
				{ time: 'Looks fine', icon: 'eye', text: 'Tests pass' },
				{ time: 'The review', icon: 'bot', tone: 'purple', side: 'after', text: 'Finds edits lost on a crash' },
				{ time: 'The fix', icon: 'checkmark', tone: 'green', text: 'Save before sending' },
			],
			outcome: { label: 'Found', value: 'Early', text: 'before any tester lost a list', tone: 'green' },
			notes: 'The split look: before and after.',
		},
		{
			id: 'statement-dark', layout: 'statement', bg: 'dark', eyebrow: 'The lesson',
			text: 'Fast is easy to ship. {{blue|Trustworthy takes a check.}}', notes: 'A statement on a dark page, for rhythm.',
		},
		{
			id: 'term', layout: 'term', term: 'Flaky test',
			def: 'A test that sometimes passes and sometimes fails, with no change to the code.',
			analogy: 'A smoke alarm that goes off when nobody is cooking.',
			exampleLabel: 'In offline mode', example: 'A sync test that fails only when the network is slow.',
			symptom: 'You re-run the tests and they pass.', todo: '**Fix it or delete it.** Never just re-run.',
			notes: 'A plain-words definition card.',
		},
		{
			id: 'build', layout: 'samples-build', eyebrow: 'A custom design', title: 'A slide that builds up, click by click',
			cards: [
				{ icon: 'edit', title: 'Write it', text: 'Saved on the phone', tone: 'blue' },
				{ icon: 'list', title: 'Queue it', text: 'Waits for a signal', tone: 'orange' },
				{ icon: 'sync', title: 'Sync it', text: 'Every device sees it', tone: 'green' },
			],
			clicks: [
				{ caption: 'First, the edit is saved on the phone.', say: 'Nothing leaves the phone yet.' },
				{ caption: 'Then it waits in a queue.', say: 'The queue survives a restart.' },
				{ caption: 'Back online, it syncs.', say: 'Every device sees the change.' },
			],
			notes: 'Drawn by designs/samples.mjs: one PDF page per click.',
		},
		{
			id: 'end', layout: 'end', title: 'Questions?', url: 'https://github.com/federicobrancasi/pr-studio', meta: 'pr-studio  \u00b7  layout samples',
			notes: 'The end card, with a link and its QR code.',
		},
	],
};

export default {
	title: 'Layout samples',
	ref: 'pr-studio  \u00b7  layout samples (made-up demo data)',
	sections: [openers, processes, choices, data, stories],
};
