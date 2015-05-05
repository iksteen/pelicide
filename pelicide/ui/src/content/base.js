import {slugify, dialog} from 'src/util'
import API from 'src/api'
import jQuery from 'jquery'
import 'phstc/jquery-dateFormat'
import 'vitmalina/w2ui'

function getPathFromRecord(record) {
    return {
        path: record.create_in ? record.create_in.split('/') : [],
        name: slugify(record.title) + '.' + record.extension.id
    }
}

export default class BaseContent {
    constructor(project) {
        this.project = project;
        this._form = null;
        this._templates = {};
        this._extensions = [];
    }

    init(type, statuses) {
        return this.loadExtensions(type)
            .then(() => {
                this._form = this.form(type, statuses);
            });
    }

    loadExtensions(type) {
        return API.list_extensions()
            .then((pelican_extensions) => {
                pelican_extensions = new Set(pelican_extensions);
                for (let e of this.project.pelicide.editor.editors.values()) {
                    if (e.templates && e.templates[type]) {
                        let template = e.templates[type];
                        for (let extension of e.extensions.values()) {
                            if (pelican_extensions.has(extension)) {
                                this._templates[extension] = template;
                                this._extensions.push(extension);
                            }
                        }
                    }
                }
            });
    }

    form(type, statuses) {
        var project = this.project;
        return jQuery().w2form({
            name: `create_${type}`,
            style: 'border: 0px; background-color: transparent;',
            fields: [
                {field: 'title', type: 'text', required: true, html: {caption: 'Title', attr: 'style="width: 250px"'}},
                {field: 'category', type: 'combo', html: {caption: 'Category:', attr: 'style="width: 250px"'}},
                {field: 'status', type: 'list', required: true, options: {items: statuses}, html: {caption: 'Status', attr: 'style="width: 250px"'}},
                {field: 'extension', type: 'list', required: true, options: {items: this._extensions}, html: {caption: 'File type', attr: 'style="width: 250px"'}},
                {field: 'create_in', type: 'combo', html: {caption: 'Create in:', attr: 'style="width: 250px"'}}
            ],
            record: {},
            actions: {
                Cancel: function () { this.cancel(); },
                Create: function () { this.ok(); }
            },
            onValidate: function (event) {
                var path = getPathFromRecord(this.record);
                if (project.getFile(path.path, path.name)) {
                    event.errors.push({
                        field: this.get('title'),
                        error: 'File already exists'
                    });
                }
            }
        });
    }

    create(title, paths) {
        var categories = this.project.categories;

        this._form.set('category', {options: {items: categories}});
        this._form.set('create_in', {options: {items: paths}});
        this._form.record = {
            status: this._form.get('status').options.items[0],
            extension: this._extensions[0],
            create_in: paths[0]
        };

        return dialog({title, form: this._form})
            .then(record => {
                Object.assign(record, {
                    slug: slugify(record.title),
                    date: jQuery.format.date(new Date(), 'yyyy-MM-dd HH:mm')
                });

                var path = getPathFromRecord(record),
                    body = this._templates[record.extension.id](record);

                return this.project.pelicide.editor.close()
                    .then(() => API.set_content(path.path, path.name, body))
                    .then(() => this.project.reload())
                    .then(() => this.project.pelicide.editor.open(this.project.getFile(path.path, path.name)));
            })
    }
}
