using System;
using System.Collections.Generic;
using System.Diagnostics;

namespace N2.Web
{
	/// <summary>
	/// A data carrier used to pass data about a found content item and 
	/// it's template from the content item to the url rewriter.
	/// </summary>
	[Serializable, DebuggerDisplay("PathData ({CurrentItem})")]
	public class PathData
	{
		#region Static
		public const string DefaultAction = "";

		/// <summary>An empty path. This probably indicates that the path didn't correspond to an item in the hierarchy.</summary>
		public static PathData Empty
		{
			get { return new PathData(); }
		}

		/// <summary>Creates a path that isn't rewritten to it's template.</summary>
		/// <param name="item">The item associated with path.</param>
		/// <returns>A path data that is not rewritten.</returns>
		public static PathData NonRewritable(ContentItem item)
		{
			return new PathData(item, null) {IsRewritable = false};
		}

		static string itemQueryKey = "item";
		static string pageQueryKey = "page";
		public static string ItemQueryKey
		{
			get { return itemQueryKey; }
			set { itemQueryKey = value; }
		}
		public static string PageQueryKey
		{
			get { return pageQueryKey; }
			set { pageQueryKey = value; }
		}
		#endregion


		ContentItem currentPage;
		
		public PathData(ContentItem item, string templateUrl, string action, string arguments)
			: this()
		{
			if(item != null)
			{
				CurrentItem = item;
				ID = item.ID;
			}
			TemplateUrl = templateUrl;
			Action = action;
			Argument = arguments;
		}

		public PathData(ContentItem item, string templateUrl)
			: this(item, templateUrl, DefaultAction, string.Empty)
		{

		}

		public PathData(int id, string path, string templateUrl, string action, string arguments)
			: this()
		{
			ID = id;
			Path = path;
			TemplateUrl = templateUrl;
			Action = action;
			Argument = arguments;
		}

		public PathData()
		{
			QueryParameters = new Dictionary<string, string>();
			IsRewritable = true;
		}

		/// <summary>The item behind this path.</summary>
		public ContentItem CurrentItem { get; set; }

		/// <summary>The page behind this path (might differ from CurrentItem when the path leads to a part).</summary>
		public ContentItem CurrentPage
		{
			get { return currentPage ?? CurrentItem; }
			set { currentPage = value;}
		}

		/// <summary>The template handling this path.</summary>
		public string TemplateUrl { get; set; }
		
		/// <summary>The identifier of the content item behind this path.</summary>
		public int ID { get; set; }

		/// <summary>?</summary>
		public string Path { get; set; }

		/// <summary>An optional action to separate templates handling an item.</summary>
		public string Action { get; set; }

		/// <summary>An additional argument to the action.</summary>
		public string Argument { get; set; }

		/// <summary>Query parameters passed on to the template.</summary>
		public IDictionary<string, string> QueryParameters { get; set; }
		
		/// <summary>Indicates that an existing file handle this path and it shouldn't be rewritten.</summary>
		public bool HonorExistingFile { get; set; }
		
		/// <summary>Indicates that this path shouldn't be rewritten.</summary>
		public bool IsRewritable { get; set; }

		public virtual Url RewrittenUrl
		{
			get
			{
				if(IsEmpty() || string.IsNullOrEmpty(TemplateUrl))
					return null;

				if (CurrentItem.IsPage)
					return Url.Parse(TemplateUrl).UpdateQuery(QueryParameters).SetQueryParameter(PathData.PageQueryKey, CurrentItem.ID);
				
				for (ContentItem ancestor = CurrentItem.Parent; ancestor != null; ancestor = ancestor.Parent)
					if (ancestor.IsPage)
						return ancestor.FindPath(DefaultAction).RewrittenUrl.UpdateQuery(QueryParameters).SetQueryParameter(PathData.ItemQueryKey, CurrentItem.ID);

				if (CurrentItem.VersionOf != null)
					return CurrentItem.VersionOf.FindPath(DefaultAction).RewrittenUrl.UpdateQuery(QueryParameters).SetQueryParameter(PathData.ItemQueryKey, CurrentItem.ID);

				throw new TemplateNotFoundException(CurrentItem);
			}
		}

		public virtual PathData UpdateParameters(IDictionary<string, string> queryString)
		{
			foreach (KeyValuePair<string, string> pair in queryString)
				QueryParameters[pair.Key] = pair.Value;
			return this;
		}

		/// <summary>Returns a copy of the path data stripped of the request specific instance of the content item.</summary>
		/// <returns>A copy of the path data.</returns>
		public virtual PathData Detach()
		{
			PathData data = new PathData(ID, Path, TemplateUrl, Action, Argument);
			data.QueryParameters = new Dictionary<string, string>(data.QueryParameters);
			return data;
		}

		/// <summary>Creates a copy of the PathData with a content item retrieved from the supplied persister. The reason for this is that PathData can be cached and we don't want to share instances between requests.</summary>
		/// <param name="persister">The perister providing the item.</param>
		/// <returns>A copy of the path data.</returns>
		public virtual PathData Attach(N2.Persistence.IPersister persister)
		{
			ContentItem item = persister.Repository.Load(ID);
			PathData data = new PathData(item, TemplateUrl, Action, Argument);
			data.QueryParameters = new Dictionary<string, string>(QueryParameters);
			return data;
		}

		public virtual PathData SetArguments(string argument)
		{
			Argument = argument;
			return this;
		}

		/// <summary>Checks whether the path contains data.</summary>
		/// <returns>True if the path is empty.</returns>
		public virtual bool IsEmpty()
		{
			return CurrentItem == null;
		}
	}
}