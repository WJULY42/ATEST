// 任务系统：探索星球、扫描生物、采集资源、抵达坐标
export class QuestSystem {
  constructor() {
    this.quests = [];
  }

  add(id, text, goal = 1) {
    if (this.quests.some((q) => q.id === id)) return;
    const q = { id, text, goal, progress: 0, done: false };
    this.quests.push(q);
    return q;
  }

  // type: 'visit' | 'scan' | 'collect' | 'warp'，value 匹配计数
  signal(type, value = 1) {
    const changed = [];
    for (const q of this.quests) {
      if (q.done) continue;
      if (q.type !== type) continue;
      if (q.match && !q.match(value)) continue;
      q.progress = Math.min(q.goal, q.progress + 1);
      if (q.progress >= q.goal) { q.done = true; }
      changed.push(q);
    }
    return changed;
  }

  make(id, text, type, goal, match) {
    const q = this.add(id, text, goal);
    if (q) { q.type = type; q.match = match; }
    return q;
  }

  activeList() {
    return this.quests.filter((q) => !q.claimed).slice(0, 4)
      .map((q) => ({ text: `${q.text} (${q.progress}/${q.goal})`, done: q.done }));
  }

  serialize() {
    return this.quests.map(({ id, text, goal, progress, done }) => ({ id, text, goal, progress, done }));
  }
  load(arr) {
    this.quests = (arr || []).map((q) => ({ ...q, type: q.id.split(':')[0], claimed: q.done }));
  }
}
