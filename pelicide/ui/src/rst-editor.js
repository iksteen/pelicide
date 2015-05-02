import CMEditor from 'src/cm-editor';
import 'codemirror/mode/rst/rst';

export default class RSTEditor extends CMEditor {
    constructor(pelicide, parent_el, content) {
        super(pelicide, parent_el, content);
    }

    get mode() { return 'rst'; }

    static get formats() {
        return ['rst'];
    }

    static get templates() {
        return {
            article(record) {
                return `${record.title}
${'#'.repeat(record.title.length)}

:date: ${record.date}
:status: ${record.status.id}
:tags: `+ (record.category ? `
:category: ${record.category}` : '') + `
:slug: ${record.slug}

`;
            }
        }
    }
}
