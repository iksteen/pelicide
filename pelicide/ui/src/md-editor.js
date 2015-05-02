import CMEditor from 'src/cm-editor';
import 'codemirror/mode/markdown/markdown';

export default class MDEditor extends CMEditor {
    constructor(pelicide, parent_el, content) {
        super(pelicide, parent_el, content);
    }

    get mode() { return 'markdown'; }

    static get formats() {
        return ['md', 'markdown', 'mdown'];
    }

    static get templates() {
        return {
            article(record) {
                return `Title: ${record.title}
Date: ${record.date}
Status: ${record.status.id}
Tags:`  + (record.category ? `
Category: ${record.category}` : '') + `
Slug: ${record.slug}

`;
            }
        }
    }
}
