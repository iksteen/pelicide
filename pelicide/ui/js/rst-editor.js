import jQuery from 'jquery';
import {CMEditor} from 'js/cm-editor';
import _ from 'codemirror/mode/rst/rst';

export class RSTEditor extends CMEditor {
    constructor(pelicide, parent_el, content) {
        super(pelicide, parent_el, content);
    }

    get mode() { return 'rst'; }

    static get formats() {
        return ['rst'];
    }

    static get templates() {
        return {
            article: function (record) {
                var titleLen = record.title.length;
                return record.title + '\n' +
                    (new Array(titleLen + 1).join('#')) + '\n\n' +
                    ':date: ' + record.date + '\n' +
                    ':status: ' + record.status.id + '\n' +
                    ':tags: \n' +
                    (record.category ? (':category: ' + record.category + '\n') : '') +
                    ':slug: ' + record.slug + '\n\n';
            }
        }
    }
}
