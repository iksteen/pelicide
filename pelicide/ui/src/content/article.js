import {alert} from 'src/util'
import API from 'src/api'
import BaseContent from 'src/content/base'

export default class ArticleContent extends BaseContent {
    constructor(project) {
        super(project);

        this._draftNodeId = null;
        this._publishedNodeId = null;
    }

    init() {
        this._draftNodeId = this.project.addContentType('Draft articles');
        this._publishedNodeId = this.project.addContentType('Published articles');

        super.init('article', ['draft', 'published']);

        this.project.addCreateContent({
            text: 'Create article',
            icon: 'fa fa-newspaper-o',
            onClick: () => this.create()
        });
    }

    scan(file) {
        switch (file.type) {
            case 'pelican.contents.Article':
                return [this._publishedNodeId, file.meta.category];
            case 'pelican.contents.Draft':
                return [this._draftNodeId];
        }
    }

    create() {
        return API.get('ARTICLE_PATHS')
            .then(paths => super.create('Create article', paths))
            .catch(alert);
    }
}
