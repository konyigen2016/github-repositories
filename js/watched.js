(function() {
	
	window.Watched = {
	
		/**
		 * Init
		 */
		init: function(){
			this.filter = new Filter("Watched");
		},
	
		/**
		 * Display
		 */
		display: {
	
			/**
			 * Append
			 * 
			 * @param contextId ID of context requestion display append.
			 * @param repos Watched repositories to append to display.
			 */
			append: function(contextId, repos) {
				var list = jQuery('.watched_list');
	
				// If a list has not yet been created.
				if(list.length == 0) {
					repos = Watched.filter.data.recentlyPushed(repos);
					Watched.display.list(contextId, repos);
				}
	
				// Append the list.
				else {
					Content.post(contextId, "Watched", function() {
						for(var i in repos) {
							var repo = repos[i];
	
							var old = list.find('li.repo[id="' + repo.id + '"]');
							var temp = list.find('li.repo:first-child');
							var html = Watched.html.item(repo);
	
							while(temp.length > 0 && temp.attr('pushed_at') > repo.pushed_at) {
								temp = temp.next();
							}
	
							if(temp.length == 0 || repo.pushed_at == null) {
								list.append(html);
							}
							else {
								jQuery(html).insertBefore(temp);
							}
	
							if(old.length > 0) {
								old.remove();
							}

							// Check if item should be filtered.
							repo = list.find('li.repo[id="' + repo.id + '"]');
							Watched.filter.dom(repo);
						}
					});
				}
			},
			
			/**
			 * Clean
			 * 
			 * Remove unwatched repositories on refresh.
			 * 
			 * @param contextId Context ID requesting clean.
			 * @param repos Full list of watched repositories.
			 */
			clean: function(contextId, repos) {
				var list = jQuery('.watched_list');
				var remove = [];
				
				// Look for DOM items to remove.
				list.find('.item').each( function() {
					var item = jQuery(this);
					for(var i = 0; i < repos.length; i++) {
						if(item.attr('id') == repos[i].id) {
							return;
						}
					}
					remove.push(item);
				});

				// Remove deleted repositories from DOM.
				for(var i in remove) {
					remove[i].remove();
				}
			},
	
			/**
			 * List
			 * 
			 * @param contextId Context ID requesting display.
			 * @param repos Watched repositories to be displayed.
			 */
			list: function(contextId, repos) {
				Content.post(contextId, "Watched", function() {
					Content.display(Watched.html.list(repos));
					Watched.filter.bind();
					Watched.filter.dom();
				});
			}
		},
	
		/**
		 * HTML
		 */
		html: {
	
			/**
			 * Item 
			 *
			 * @param repo Item to generate HTML for.
			 * @return Watched repo list item HTML.
			 */
			item: function(repo) {

				if(!repo) {
					return "";
				}
	
				return "<li class='item repo " + (repo['private'] ? "private" : "public") + (repo.fork ? " fork" : " source" ) + "' id='" + repo.id + "' pushed_at='" + repo.pushed_at + "' "
				     + "tags='" + repo.owner.login + " " + repo.name + "'>"
				     + "<a href='" + repo.html_url + "' target='_blank'>"
					 + "<span class='user'>" + repo.owner.login + "</span>"
					 + "/"
					 + "<span class='repo'>" + repo.name + "</span>"
					 + "<span class='arrow'></span>"
					 + "</a>"
					 + "</li>";
			},
	
			/**
			 * List 
			 *
			 * @param repos Watched repos to create HTML list for.
			 * @return Watched repo list in HTML.
			 */
			list: function(repos) {	
				var html = Repos.filter.html();	
				html += "<ul class='watched_list'>";
	
				if(repos) {
					for(var i in repos) {
						html += this.item(repos[i]);
					}
				}
	
				html += "</ul>";
				return html;
			}
		},
	
		/**
		 * Load
		 */
		load: {
	
			/**
			 * Cache 
			 *
			 * Load watched repos from cache.
			 * 
			 * @param context Context requesting load.
			 */
			cache: function(context) {
				var cache = Cache.load(context.id, "Watched");
	
				if(cache != null) {
					Watched.display.list(context.id, cache.data);
				}
	
				if(!cache || cache.expired) {
					Watched.load.refresh(context);
				}
			},
	
			/**
			 * GitHub 
			 *
			 * Load watched repos from GitHub (this will run in the background page).
			 * 
			 * @param context Context requesting repositories.
			 * @param token Users OAuth2 token.
			 */
			github: function(context, token) {
	
				/* GitHub only returns 40 repositories per page so use recursion.
				 *
				 */ 
				(function getWatchedRepos(buffer, page) {
					jQuery.getJSON("https://api.github.com/user/watched", {access_token: token, page: page})
						.success(function(json) {
							if(json.length > 0) {
								json = Watched.filter.data.removeUserRepos(json, context.login);
								
								Socket.postMessage({
									namespace: "Watched", 
									literal: "display", 
									method: "append", 
									args: [context.id, json]
								});
								
								getWatchedRepos(buffer.concat(json), ++page);
							}
							else {
								buffer = Watched.filter.data.recentlyPushed(buffer);
								
								// Clean unwatched repos from display.
								Socket.postMessage({
									namespace: "Watched",
									literal: "display",
									method: "clean",
									args: [context.id, buffer]
								});
								
								Cache.save(context.id, "Watched", buffer);
								Socket.postTaskComplete();
							}
						});
				})([], 1);	
			},
	
			/**
			 * Refresh 
			 *
			 * Post a task to the background page to begin loading data from GitHub.
			 *
			 * @param context Context requesting refresh.
			 */
			refresh: function(context) {
				Socket.postTask({
					namespace: "Watched", 
					literal: "load", 
					method: "github", 
					args: [context, OAuth2.getToken()]
				});
			}
		}
	};
	
	Watched.init();
	
})();