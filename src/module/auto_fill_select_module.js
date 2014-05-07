(function() {

var AutoFillSelectModule = Module.Base.extend({

	prototype: {

		options: {
			charset: "utf-8",
			dataLabelKey: "label",
			dataRootKey: null,
			dataValueKey: "value",
			busyClass: "autofill-busy",
			busyText: "Please wait...",
			defaultText: "Choose",
			pendingClass: "autofill-pending",
			pendingText: "..."
		},

		onControllerRegistered: function(frontController, controllerId) {
			frontController.registerEvents("change");
		},

		populate: function change(event, element, params) {
			var source = event.target,
			    groupName = source.getAttribute("data-autofill-group"),
			    group, target;

			if (!groupName) {
				return;
			}

			group = new Group(this.element, groupName);
			target = group.getTarget(source);

			if (!target) {
				return;
			}

			this._fill(group, source, target);
		},

		_getValue: function(select) {
			var value = null;

			if (select.multiple) {
				value = [];

				for (var i = 0; i < select.options.length; i++) {
					if (select.options[i].selected) {
						value.push(select.options[i].value);
					}
				}
			}
			else {
				value = select.value;
			}

			return value;
		},

		_fill: function(group, source, target) {
			var xhr    = new XMLHttpRequest(),
				url    = source.getAttribute("data-autofill-url")
				method = (source.getAttribute("data-autofill-method") || "GET").toUpperCase(),
				param  = source.getAttribute("data-autofill-param")   || source.name,
				value  = this._getValue(source),
				self   = this,
				data   = null,
				onreadystatechange = function() {
					if (this.readyState < 4) {
						return;
					}
					else if (this.status === 200) {
						success();
						complete();
					}
					else if (this.status >= 400) {
						error();
						complete();
						throw new Error("Request to " + method + " " + url + " failed with status: " + this.status);
					}
				},
				success = function() {
					var type = xhr.getResponseHeader("content-type");

					if (/(text|application)\/json/i.test(type)) {
						self._fillFromData(JSON.parse(xhr.responseText), group, source, target);
					}
					else if (/text\/html/i.test(type)) {
						self._fillFromHtml(xhr.responseText, group, source, target);
					}
					else {
						throw new Error("Unknown content-type: " + type);
					}

					target.classList.remove(self.options.busyClass);
					target.disabled = false;
				},
				error = function() {
				},
				complete = function() {
					group.destructor();
					xhr = xhr.onreadystatechange = self = group = source = target = null;
				};

			this._markTargetBusy(target, group);

			if (!url) {
				throw new Error("Missing required attribute: data-autofill-url (" + source.name + ")");
			}

			if (value instanceof Array) {
				data = [];

				for (var i = 0, length = value.length; i < length; i++) {
					data.push(this.window.encodeURIComponent(param) + "=" + this.window.encodeURIComponent(value[i]));
				}

				data = data.join("&");
			}
			else {
				data = this.window.encodeURIComponent(param) + "=" + this.window.encodeURIComponent(value);
			}

			if (method === "GET") {
				url += (url.indexOf("?") === -1 ? "?" : "&") + data;
			}

			xhr.onreadystatechange = onreadystatechange;
			xhr.open(method, url);
			xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");

			if (method === "POST") {
				xhr.setRequestHeader("Content-Type: application/x-www-form-urlencoded; charset=" + this.options.charset);
			}

			xhr.send(data);
		},

		_fillFromData: function(data, group, source, target) {
			data = this.options.dataRootKey
			     ? data[this.options.dataRootKey]
			     : data;

			var label = this.options.dataLabelKey,
			    value = this.options.dataValueKey,
			    i = 0, length = data.length,
			    placeholder = target.getAttribute("data-autofill-placeholder") || this.options.defaultText,
			    option;

			utils.emptyNode(target);

			// create "default" option
			option = utils.createOption("", placeholder, this.document);
			target.appendChild(option)

			// fill options
			for (i; i < length; i++) {
				option = utils.createOption(data[i][value], data[i][label], this.document);
				target.appendChild(option);
			}
		},

		_fillFromHtml: function(html, group, source, target) {
			target.innerHTML = html;
		},

		_markTargetBusy: function(target, group) {
			target.classList.remove(this.options.pendingClass);
			target.classList.add(this.options.busyClass);
			target.options[0].innerHTML = this.options.busyText;
			target.disabled = true;

			group.forEachTarget(target, function(t) {
				utils.emptyNode(t);
				t.appendChild(
					utils.createOption("", this.options.pendingText, this.document));
				t.classList.remove(this.options.busyClass);
				t.classList.add(this.options.pendingClass);
				t.disabled = true;
			}, this);
		}

	}

});

function Group(element, name) {
	this.element = element || null;
	this.name = name || null;
}

Group.prototype = {

	element: null,

	name: null,

	_selects: null,

	constructor: Group,

	destructor: function() {
		this._selects = this.element = null;
	},

	getSelects: function() {
		return this._selects || (this._selects = this.element.querySelectorAll("select[data-autofill-group=" + this.name + "]"));
	},

	getTarget: function(select) {
		var target = select.getAttribute("data-autofill-target"),
		    selects = this.getSelects(),
		    i = 0,
		    targetSelect = null;

		if (target) {
			for (i; i < selects.length; i++) {
				if (selects[i].name === target) {
					targetSelect = selects[i];
					break;
				}
			}
		}

		return targetSelect;
	},

	forEachTarget: function(select, callback, context) {
		context = context || this;
		var target = select;

		while (target = this.getTarget(target)) {
			if (callback.call(context, target, select, this) === false) {
				break;
			}
		}
	}

};

var utils = {
	createOption: function(value, label, document) {
		var option = document.createElement("option");
		option.value = value;
		option.innerHTML = label;

		return option;
	},
	emptyNode: function(node) {
		while (node.childNodes.length) {
			node.removeChild(node.lastChild);
		}
	}
};

Module.AutoFillSelectModule = AutoFillSelectModule;

})();
