export namespace fs {
	
	export class FileNode {
	    name: string;
	    path: string;
	    isDir: boolean;
	    children: FileNode[];
	    // Go type: time
	    modTime: any;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new FileNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.isDir = source["isDir"];
	        this.children = this.convertValues(source["children"], FileNode);
	        this.modTime = this.convertValues(source["modTime"], null);
	        this.size = source["size"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FileWatcher {
	
	
	    static createFrom(source: any = {}) {
	        return new FileWatcher(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}

}

export namespace git {
	
	export class GitBranch {
	    name: string;
	    current: boolean;
	    remote?: string;
	    ahead: number;
	    behind: number;
	
	    static createFrom(source: any = {}) {
	        return new GitBranch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.current = source["current"];
	        this.remote = source["remote"];
	        this.ahead = source["ahead"];
	        this.behind = source["behind"];
	    }
	}
	export class GitCommit {
	    hash: string;
	    shortHash: string;
	    message: string;
	    author: string;
	    email: string;
	    date: string;
	
	    static createFrom(source: any = {}) {
	        return new GitCommit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hash = source["hash"];
	        this.shortHash = source["shortHash"];
	        this.message = source["message"];
	        this.author = source["author"];
	        this.email = source["email"];
	        this.date = source["date"];
	    }
	}
	export class GitDiff {
	    path: string;
	    oldPath?: string;
	    content: string;
	    isNew: boolean;
	    isDeleted: boolean;
	    isBinary: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GitDiff(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.oldPath = source["oldPath"];
	        this.content = source["content"];
	        this.isNew = source["isNew"];
	        this.isDeleted = source["isDeleted"];
	        this.isBinary = source["isBinary"];
	    }
	}
	export class GitFileStatus {
	    path: string;
	    indexStatus: string;
	    worktreeStatus: string;
	    staged: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GitFileStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.indexStatus = source["indexStatus"];
	        this.worktreeStatus = source["worktreeStatus"];
	        this.staged = source["staged"];
	    }
	}
	export class GitStatus {
	    branch: string;
	    ahead: number;
	    behind: number;
	    modified: GitFileStatus[];
	    added: GitFileStatus[];
	    deleted: GitFileStatus[];
	    untracked: GitFileStatus[];
	    renamed: GitFileStatus[];
	    conflicted: GitFileStatus[];
	    staged: GitFileStatus[];
	    isClean: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GitStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.branch = source["branch"];
	        this.ahead = source["ahead"];
	        this.behind = source["behind"];
	        this.modified = this.convertValues(source["modified"], GitFileStatus);
	        this.added = this.convertValues(source["added"], GitFileStatus);
	        this.deleted = this.convertValues(source["deleted"], GitFileStatus);
	        this.untracked = this.convertValues(source["untracked"], GitFileStatus);
	        this.renamed = this.convertValues(source["renamed"], GitFileStatus);
	        this.conflicted = this.convertValues(source["conflicted"], GitFileStatus);
	        this.staged = this.convertValues(source["staged"], GitFileStatus);
	        this.isClean = source["isClean"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GitSummary {
	    branch: string;
	    ahead: number;
	    behind: number;
	    modifiedCount: number;
	    addedCount: number;
	    deletedCount: number;
	    untrackedCount: number;
	    stagedCount: number;
	    totalChanges: number;
	    isClean: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GitSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.branch = source["branch"];
	        this.ahead = source["ahead"];
	        this.behind = source["behind"];
	        this.modifiedCount = source["modifiedCount"];
	        this.addedCount = source["addedCount"];
	        this.deletedCount = source["deletedCount"];
	        this.untrackedCount = source["untrackedCount"];
	        this.stagedCount = source["stagedCount"];
	        this.totalChanges = source["totalChanges"];
	        this.isClean = source["isClean"];
	    }
	}

}

