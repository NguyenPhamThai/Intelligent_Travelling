// src/components/SafetyPanel.ts (extends Panel)
import { Panel } from './Panel';
import { getAllEvents } from '../services/safety/data-pipeline';

export class SafetyPanel extends Panel {
  constructor(options: any) {
    super(options);
  }

  async loadData() {
    const events = await getAllEvents();
    // Render events on map/UI
    this.render(events);
  }

  private render(events: any[]) {
    // Simple render logic
    this.content.innerHTML = `<h3>Safety Events</h3><ul>${events.map(e => `<li>${e.type}: ${e.severity}</li>`).join('')}</ul>`;
  }
}