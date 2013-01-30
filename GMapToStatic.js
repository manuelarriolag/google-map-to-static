(function(){

	/**
	* Class form creating static Google Maps. Requires jQuery.
	* http://code.google.com/apis/maps/documentation/staticmaps/#MapTypes
	*
	* @class StaticMapCreator
	*/
	var StaticMap = function(googleMap){
		var _this = this;
		var _baseUrl = "http://maps.googleapis.com/maps/api/staticmap?sensor=false";
		var _params = {
			'size': "300x300",
			'zoom': "12",
			'maptype': "roadmap",
			'center': undefined
		};

		_this.markers = new StaticMapMarkers(_this);
		_this.route = new StaticMapRoute(_this);
		_this.map = googleMap;
		_this.latLngEncoder = new LatLngEncoder();
		_this.event = new EventDispatcher();

		_this.objectToUrlParam = function(obj){
			var key;
			var param = '';
			for (key in obj){
				if (obj[key] != null && obj[key] != undefined){
					param += '&' + key + '=' + obj[key];
				}
			}
			return param;
		}

		_this.latLngToStr = function(latLng){
			return latLng.lat() + ',' + latLng.lng();
		}

		_this._mapSizeToStr = function(googleMap, isPremium){
			var div = $(googleMap.getDiv());
			var width = 0;
			var height = 0;

			if (isPremium){
				width = Math.min(div.width(), 2048);
				height = Math.min(div.height(), 2048);
			} else {
				width = Math.min(div.width(), 640);
				height = Math.min(div.height(), 640);
			}

			return width + 'x' + height;
		}

		var _createFromGoogleMap = function(){
			$.extend(_params, {
				size: _this._mapSizeToStr(_this.map),
				zoom: _this.map.getZoom(),
				center: _this.latLngToStr(_this.map.getCenter()),
				maptype: _this.map.getMapTypeId().toLowerCase()
			});
		}

		_this.prepareUrl = function(){
			if (_this.route.isSet()){
				if (_this.route.isLoading()){
					var iv = setInterval(function(){
						if (!_this.route.isLoading()){

							var startMarker = new StaticMapMarker();
							startMarker.setOptions({
								location: _this.route.getOrigin(),
								color:'green',
								label:'A'
							});

							var endMarker = new StaticMapMarker();
							endMarker.setOptions({
								location: _this.route.getDestination(),
								color:'green',
								label:'B'
							});

							_this.markers.addMarker(startMarker);
							_this.markers.addMarker(endMarker);

							clearInterval(iv);

							_prepareUrl();
						}
					}, 20);

				} else {
					_prepareUrl();
				}

			} else {
				_prepareUrl();
			}
		}

		var _prepareUrl = function(){
			_createFromGoogleMap();
			_this.event.fire(
				'onurlprepared',
				_baseUrl +
				_this.objectToUrlParam(_params) +
				_this.markers.getAsUrlParam() +
				_this.route.getAsUrlParam()
			);
		}
	}


	/**
	* @class EventDispatcher
	*/
	var EventDispatcher = function(){
		var _this = this;
		var _events = {
			'onurlprepared': function(){}
		}

		_this.addListener = function(type, callback){
			_events[type] = callback;
		}

		_this.fire = function(type){
			_events[type].apply(_this, Array.prototype.slice.call(arguments, 1));
		}
	}


	/**
	* http://code.google.com/apis/maps/documentation/utilities/polylinealgorithm.html
	*
	* @class LatLngEncoder
	*/
	var LatLngEncoder = function(){
		function _encode(num){

			var isNeg = (num < 0);
			var chars = [];

			num = Math.round(num*1e5);
			num = num << 1;

			if (isNeg){
				num = ~num;
			}

			while (num > 31){
				chars.push( (num & 31) | 0x20 );
				num = num >> 5;
			}

			chars.push(num);

			chars = chars.map(function(v){
				return String.fromCharCode(v + 63);
			});

			return chars.join('');
		}

		this.encode = function(latLng){
			var id;
			var lastLat = 0;
			var lastLng = 0
			var str = 'enc:';

			for (id in latLng){
				str += this.encodeLatLng(latLng[id].lat() - lastLat, latLng[id].lng() - lastLng)
				lastLat = latLng[id].lat();
				lastLng = latLng[id].lng();
			}
			return str;
		}

		this.encodeValue = function(val){
			return _encode(val);
		}

		this.encodeLatLng = function(lat, lng){
			return _encode(lat) + _encode(lng);
		}
	}


	/**
	* @class StaticMapMarkers
	*/
	var StaticMapMarkers = function(staticMap){
		var _this = this;
		var markers = []

		_this.getStaticMap = function(){
			return staticMap;
		}

		/**
		 * Adds marker to collection
		 *
		 * @param marker   Marker. Not Google Marker but instance of
		 *                 StaticMapMarker class.
		 */
		_this.addMarker = function(marker){
			markers.push(marker);
		}

		/**
		 * Adds Google Marker to collection by converting it into instance of
		 * StaticMapMarker class.
		 *
		 * @param googleMarker
		 */
		_this.addGoogleMarker = function(googleMarker){
			var marker = new StaticMapMarker(_this);
			marker.setOptions({
				incon: googleMarker.getIcon(),
				shadow: googleMarker.getShadow(),
				location: googleMarker.getPosition()
			});

			markers.push(marker);
		}

		_this.getAll = function(){
			return markers;
		}

		_this.getGrouped = function(markers){
			if (markers.length === 0){
				return [];
			} else if (markers.length === 1) {
				return [[markers[0]]];
			} else {
				var groups = [];
				var group;
				var current;
				var left = markers.slice(0);
				var k;
				var tempLeft = [];

				while (left.length > 0){
					tempLeft = [];
					group = [];
					current = left[0];
					left = left.slice(1);
					group.push(current);

					for (k in left){
						if(current.canBeMergedWith(left[k])){
							group.push(left[k])
						}else{
							tempLeft.push(left[k])
						}
					}

					left = tempLeft;
					groups.push(group)
				}

				return groups;
			}
		}

		_this.getGroupAsUrlParam = function(group){
			var id;
			var first = group[0].getOptions();
			var commons = [];
			var commonsStr = '';
			var locations = []

			if (first.color != null && first.color != undefined){
				commons.push('color:' + first.color)
			}

			if (first.size != null && first.size != undefined){
				commons.push('size:' + first.size)
			}

			if (first.icon != null && first.icon != undefined){
				commons.push('icon:' + first.icon)
			}

			if (first.shadow != null && first.shadow != undefined){
				commons.push('shadow:' + first.shadow)
			}

			if (first.label != null && first.label != undefined){
				commons.push('label:' + first.label)
			}

			if (commons.length > 0){
				commonsStr = commons.join('|') + '|';
			}

			for (id in group){
				locations.push(staticMap.latLngToStr(group[id].getOptions().location))
			}

			if(locations.length > 0){
				return '&markers=' + commonsStr + locations.join('|');
			}

			return '';
		}

		_this.getAsUrlParam = function(){
			var groups = _this.getGrouped(markers);
			var groupId;
			var param = '';

			for (groupId in groups){
				param += _this.getGroupAsUrlParam(groups[groupId])
			}
			return param;
		}
	}


	/**
	* @class StaticMapMarker
	*/
	var StaticMapMarker = function(){
		var _this = this;
		var opts = {
			size: undefined,
			color: undefined,
			location: undefined,
			icon: undefined,
			shadow: undefined,
			label: undefined
		}

		_this.setOptions = function(options){
			$.extend(opts, options)
		}

		_this.getOptions = function(){
			return opts;
		}

		_this.canBeMergedWith = function(marker){
			var cmpOpt = marker.getOptions();

			if (cmpOpt.size != opts.size){
				return false
			}

			if (cmpOpt.color != opts.color){
				return false;
			}

			if (cmpOpt.icon != opts.icon){
				return false;
			}

			if (cmpOpt.shadow != opts.shadow){
				return false;
			}

			if (cmpOpt.label != opts.label){
				return false;
			}

			return true;
		}
	}


	/**
	 * @class StaticMapRoute
	 */
	var StaticMapRoute = function(staticMap){
		var _this = this;
		var _isLoading = false;
		var _path = '&path=color:0xff0000ff|weight:3'
		var _renderer;
		var _directions;

		_this.isSet = function(){
			return !!_renderer;
		}

		_this.isLoading = function(){
			return _isLoading;
		}

		_this.getOrigin = function(){
			var routeIndex = _renderer.getRouteIndex();
			var path = _directions.routes[routeIndex].overview_path;
			return path[0];
		}

		_this.getDestination = function(){
			var routeIndex = _renderer.getRouteIndex();
			var path = _directions.routes[routeIndex].overview_path;
			return path[path.length - 1];
		}

		_this.getDirections = function(){
			return _directions;
		}

		_this.setRenderer = function(renderer){
			_isLoading = true;
			_renderer = renderer;

			var to = setInterval(function(){

				if (renderer.getDirections()){
					_directions = renderer.getDirections();
					_isLoading = false;
					clearInterval(to);
				}
			}, 10);
		}

		_this.pointsToStr = function(points){
			return points.map(staticMap.latLngToStr).join('|');
		}

		_this.pointsToEncodedStr = function(points){
			return staticMap.latLngEncoder.encode(points);
		}

		_this.getAsUrlParam = function(){
			var pathStr = '';
			if (_renderer){
				var directions = _renderer.getDirections();

				if (directions){
					var routeIndex = _renderer.getRouteIndex();
					var path = directions.routes[routeIndex].overview_path;
					var points = []
					var pointId;

					for (pointId in path){
						points.push(path[pointId]);
					}

					var pointsAsStr = _this.pointsToStr(points)
					var pointsAsEncStr = _this.pointsToEncodedStr(points)
					var pointsStr = pointsAsEncStr.length < pointsAsStr.length ? pointsAsEncStr : pointsAsStr

					if (points.length > 0){
						pathStr += _path + '|' + pointsStr;
					}
				}
			}
			//return _path + '|enc:' + directions.routes[routeIndex].overview_polyline.points
			return pathStr;
		}
	}

	window.GMapToStatic = StaticMap;
})();