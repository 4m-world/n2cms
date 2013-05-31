﻿angular.module('n2', ['n2.routes', 'n2.directives', 'n2.services', 'ui'], function () {
});

function findSelectedRecursive(node, selectedPath) {
	if (!node)
		return null;
	if (node.Current.Path == selectedPath) {
		return node;
	}
	for (var i in node.Children) {
		var n = findSelectedRecursive(node.Children[i], selectedPath);
		if (n) return n;
	}
	return null;
}

function decorate(obj, name, callback) {
	var original = obj[name] || function () { };
	obj[name] = function () {
		original.apply(this, arguments);
		callback.apply(this, arguments);
	};
};

function ManagementCtrl($scope, $window, $timeout, $interpolate, Interface, Context, Content, Security, FrameContext) {
	$scope.Content = Content;
	$scope.Security = Security;



	var viewMatch = window.location.search.match(/[?&]view=([^?&]+)/);
	var selectedMatch = window.location.search.match(/[?&]selected=([^?&]+)/);
	$scope.Interface = Interface.get({
		view: viewMatch && viewMatch[1],
		selected: selectedMatch && selectedMatch[1],
	}, function () {
		console.log("Interface loaded");
	});
	$scope.Context = {
		CurrentItem: {
			PreviewUrl: "Empty.aspx"
		},
		SelectedNode: {
		},
		ContextMenu: {
		}
	}

	$scope.select = function (node) {
		$scope.Context.SelectedNode = node;
		$timeout(function () {
			Context.get({ selected: node.Current.Path, view: $scope.Interface.Paths.ViewPreference }, function (ctx) {
				angular.extend($scope.Context, ctx);
			});
		}, 200);
		//$scope.Context.CurrentItem = node.Current;
	}

	//$scope.$watch("Context.CurrentItem.Path", function (path) {
	//	if (path) {
	//		var item = $scope.Context.CurrentItem;
	//		var loco = window.preview.location;
	//		if (loco.pathname != item.PreviewUrl && loco.pathname + loco.search != item.PreviewUrl) {
	//			console.log("path changed", path, " -- ", loco.pathname + loco.search, item.PreviewUrl);
	//			Context.get({ selected: item.Path }, function (ctx) {
	//				angular.extend($scope.Context, ctx);
	//			});
	//		}
	//	}
	//});
	$scope.$watch("Context.ContextMenu", function (menu) {
		console.log("context menu", menu);
	});

	var viewExpression = /[?&]view=[^?&]*/;
	$scope.$on("preiewloaded", function (scope, e) {
		var ctxUrl = $scope.Context.CurrentItem && $scope.Context.CurrentItem.PreviewUrl || "";
		if (e.path + e.query != ctxUrl && e.path != ctxUrl.replace(viewExpression, "")) {
			// reload
			$timeout(function () {
				console.log("URL CHANGED", e.path + e.query, "!=", ctxUrl);
				Context.get({ selectedUrl: e.path + e.query }, function (ctx) {
					//if (ctx.NotFound) {
					//	console.log("notfound", e.path + e.query);
					//	return;
					//}
					
					console.log("reloaded", ctx);
					angular.extend($scope.Context, ctx);
					$scope.$broadcast("contextchanged", $scope.Context);
				});
			}, 200);
		}
	});

	$scope.evaluateExpression = function (expr) {
		return expr && $interpolate(expr)($scope);
	};
}

function MainMenuCtrl($scope) {
	$scope.$watch("Interface.MainMenu", function (mainMenu) {
		$scope.menu = mainMenu;
	});
	$scope.$watch("Interface.User", function (user) {
		$scope.user = user;
	});
}

function SearchCtrl($scope, $timeout, Content) {
	$scope.searchExpression = "";
	var cancel = null;
	$scope.$watch("searchExpression", function (searchExpression) {
		cancel && $timeout.cancel(cancel);
		cancel = $timeout(function () {
			$scope.search(searchExpression + "*");
		}, 500);
	});
	$scope.clear = function () {
		$scope.hits = [];
		$scope.searchExpression = "";
	};
	$scope.search = function (searchExpression) {
		if (!searchExpression || searchExpression == "*") {
			return $scope.clear();
		}
		$scope.searching = true;
		Content.search({ q: searchExpression, take: 20, selected: $scope.Context.CurrentItem.Path, pages: true }, function (data) {
			$scope.hits = data.Hits;
			$scope.searching = false;
		});
	}
}

function NavigationCtrl($scope, ContextMenuFactory) {
	$scope.$watch("Interface.User.PreferredView", function (view) {
		$scope.viewPreference = view == 0
			? "draft"
			: "published";
	});

	$scope.ContextMenu = new ContextMenuFactory($scope);
}

function TrashCtrl($scope) {

}

function TrunkCtrl($scope, Content, SortHelperFactory) {
	$scope.$watch("Interface.Content", function (content) {
		$scope.node = content;
		if (content) {
			$scope.select(findSelectedRecursive(content, $scope.Interface.SelectedPath));
			console.log("selecting", $scope.Context.SelectedNode);
		}
	});
	$scope.$on("contextchanged", function (scope, ctx) {
		console.log("contextchanged", ctx);
		if (ctx.CurrentItem)
			$scope.Context.SelectedNode = findSelectedRecursive($scope.Interface.Content, ctx.CurrentItem.Path);
		else
			$scope.Context.SelectedNode = null;
	});

	$scope.toggle = function (node) {
		node.Expanded = !node.Expanded;
	};
	$scope.loadRemaining = function (node) {
		node.Loading = true;
		Content.children({ selected: node.Current.Path, skip: node.Children.length }, function (data) {
			node.Children.length--;
			for (var i in data.Children)
				node.Children.push(data.Children[i]);
			node.Loading = false;
			node.IsPaged = false;
		});
	}
	$scope.$on("moved", function (e, content) {
		console.log("moved", content);
	});
	$scope.sort = new SortHelperFactory($scope, Content);
}

function BranchCtrl($scope, Content, SortHelperFactory) {
	$scope.node = $scope.child;
	$scope.toggle = function (node) {
		if (!node.Expanded && !node.Children.length) {
			node.Loading = true;
			Content.children({ selected: node.Current.Path }, function (data) {
				node.Children = data.Children;
				node.Loading = false;
				if (data.IsPaged)
					node.IsPaged = true;
			});
		}
		node.Expanded = !node.Expanded;
	};
	$scope.sort = new SortHelperFactory($scope, Content);
}

function PageActionBarCtrl($scope, Security) {
	$scope.$watch("Interface.ActionMenu.Children", function (children) {
		var lefties = [];
		var righties = [];
		for (var i in children) {
			if (children[i].Current.Alignment == "Right")
				righties.push(children[i]);
			else
				lefties.push(children[i]);
		}
		$scope.navs =
			[
				{ Alignment: "Left", Items: lefties },
				{ Alignment: "Right", Items: righties },
			];
	});

	$scope.isDisplayable = function (item) {
		if ($scope.Context.CurrentItem && !Security.permissions.is(item.Current.RequiredPermission, $scope.Context.CurrentItem.MaximumPermission))
			return false;
		if (item.Current.DisplayedBy)
			return $scope.Context.Flags.indexOf(item.Current.DisplayedBy) >= 0;
		if (item.Current.HiddenBy)
			return $scope.Context.Flags.indexOf(item.Current.HiddenBy) < 0;
		return true;
	};
}

function PageActionCtrl($scope) {
}

function PreviewCtrl($scope) {
	$scope.frameLoaded = function (e) {
		try {
			var loco = e.target.contentWindow.location;
			$scope.$emit("preiewloaded", { path: loco.pathname, query: loco.search, url: loco.toString() });
		} catch (ex) {
			console.log(ex);
		}
	};

	$scope.$watch("Interface.SelectedPath", function (path) {
		if (path) {
			var node = findSelectedRecursive($scope.Interface.Content, path);
			$scope.src = node && node.Current && node.Current.PreviewUrl;
		}
	});
}

function AddCtrl($scope, Definitions) {
	$scope.loadDefinitions = function (node) {
		console.log("loading definitions for ", node);
		node.Selected = node.Current.Path;
		node.Loading = true;
		node.Children = Definitions.query({ selected: $scope.Context.CurrentItem.Path }, function () {
			node.Loading = false;
		});
	}
}

function LanguageCtrl($scope, Translations) {
	$scope.loadLanguages = function (node) {
		console.log("loading languages for ", node);
		node.Selected = node.Current.Path;
		node.Loading = true;
		node.Children = Translations.query({ selected: $scope.Context.CurrentItem.Path }, function () {
			node.Loading = false;
		});
	}
}

function VersionsCtrl($scope, Versions) {
	$scope.loadVersions = function (node) {
		console.log("loading versions for ", node);

		$scope.Selected = node.Current.Path;
		node.Loading = true;
		node.Children = Versions.query({ selected: $scope.Context.CurrentItem.Path }, function (versions) {
			node.Loading = false;
		});
	}
}

function PagePublishCtrl($scope, $rootScope) {
	$rootScope.$on("preiewloaded", function (scope, e) {
		
	});
}

function NotifyCtrl($scope, $timeout, Notify) {
	var defaults = { visible: true, type: "warning" };

	function clear() {
		$scope.Notify = {};
	};

	Notify.subscribe(function (options) {
		setTimeout(function () {
			$scope.Notify = angular.extend({}, defaults, options);
			options.timeout && $timeout(clear, options.timeout);
			$scope.$digest();
		}, 10);
	});
}
