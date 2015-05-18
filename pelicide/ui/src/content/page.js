import {alert} from 'src/util'
import API from 'src/api'
import BaseContent from 'src/content/base'


export default class PageContent extends BaseContent {
    constructor(project) {
        super(project);

        this._pageNodeId = null;
    }

    init() {
        this._pageNodeId = this.project.addContentType('Pages');

        super.init('page', ['published', 'hidden']);

        this.project.addCreateContent({
            text: 'Create page',
            icon: 'fa fa-file-text-o',
            onClick: () => this.create()
        });
    }

    scan(file) {
        if (file.type == 'pelican.contents.Page')
            return [this._pageNodeId];
    }

    create() {
        return API.get('PAGE_PATHS')
            .then(paths => super.create('Create page', paths))
            .catch(alert);
    }
}
