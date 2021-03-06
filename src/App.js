import React from 'react';

import Admin from './Admin';
import SearchBlock from './components/SearchBlock';
import ProductTable from './components/ProductTable';

import ProductDAO from './ProductDAO';
// import MockData from 'MockData';


/**
 * Tentar trocar os vários sorts pelo componentWillUpdate,
 * sort aí e já eraa. EDIT: Não funciona, pois vira um recursivo
 *
 * TODO: Dar um fetch na base verificando um timestamp para atualizar
 * os dados na tela
 */
export default class App extends React.Component {
	constructor(props){
		super(props);

		this.dao = new ProductDAO();

		this.changeSearchFilter = this.changeSearchFilter.bind(this);
		this.changeStockOnlyFilter = this.changeStockOnlyFilter.bind(this);
		this.handleBuy = this.handleBuy.bind(this);
		// this.adminUpdateProduct = this.adminUpdateProduct.bind(this);
		
		/* Admin */
		this.adminChangeProductValue = this.adminChangeProductValue.bind(this);
		this.addEmptyProduct = this.addEmptyProduct.bind(this);
		this.adminRevertUpdate = this.adminRevertUpdate.bind(this);

		this.state = {
			// products: [
			//   {id: 1,category: "Sporting Goods", price: "$49.99", quantity: 9, name: "Football"},
			//   {id: 2,category: "Sporting Goods", price: "$9.99", quantity: 9, name: "Baseball"},
			//   {id: 3,category: "Sporting Goods", price: "$29.99", quantity: 9, name: "Basketball"},
			//   {id: 4,category: "Electronics", price: "$99.99", quantity: 0, name: "iPod Touch"},
			//   {id: 5,category: "Electronics", price: "$399.99", quantity: 5, name: "iPhone 5"},
			//   {id: 6,category: "Electronics", price: "$199.99", quantity: 0, name: "Nexus 7"}
			// ].sort(this.sortByCategory),
			// products: new MockData().getData().sort((a, b) => {
			// 	if (a.category > b.category)
			// 		return 1
			// 	else if (a.category < b.category)
			// 		return -1;
			// 	else
			// 		return 0;
			// }),
			products: [],
			filterSearch: "",
			filterStockOnly: false
		}
	}

	componentWillMount(){
		// let products = [
		// 	  {id: 1,category: "Sporting Goods", price: "$49.99", quantity: 9, name: "Football"},
		// 	  {id: 2,category: "Sporting Goods", price: "$9.99", quantity: 9, name: "Baseball"},
		// 	  {id: 3,category: "Sporting Goods", price: "$29.99", quantity: 9, name: "Basketball"},
		// 	  {id: 4,category: "Electronics", price: "$99.99", quantity: 0, name: "iPod Touch"},
		// 	  {id: 5,category: "Electronics", price: "$399.99", quantity: 5, name: "iPhone 5"},
		// 	  {id: 6,category: "Electronics", price: "$199.99", quantity: 0, name: "Nexus 7"}
		// 	];
		// setTimeout(() => {
		// 	this.setState({products});
		// }, 3000)
		this.dao.getAllProducts(products => {
			console.log("Recebi a parada");
			this.setState({
				products
			})
		});
	}

	sortByCategory(a, b){
		let catA = a.category.toLowerCase();
		let catB = b.category.toLowerCase();

		if (catA > catB)
			return 1;
		else if (catA < catB)
			return -1;
		else
			return 0;
	}

	/*
		Problemas com debounce, como cancelo a requisição pendnete anterior,
		o callback vai embora junto e nunca é chamado, então o input continua amarelinho.
		SOLUÇÃO: Esta classe agora possui um pendentCallbacks, onde são registrados todos
		os callbacks para 
	 */
	updateProductInDatabase(product, callback) {
		let key = 'timeoutUpdateId-' + product.id;
		let pendentCallbacksKey = 'pendentCallbacks-productId' + product.id;

		// console.log("Registrando callback em", pendentCallbacksKey);
		
		if(!this[pendentCallbacksKey])
			this[pendentCallbacksKey] = [];

		this[pendentCallbacksKey].push(callback);

		/* Debounce Pattern */
		clearTimeout(this[key]);
		this[key] = setTimeout(() => {
			if (!this.isNameUnique(product))
				return alert("O produto não pode ser salvo devido a dados inválidos");

			console.log("Enviando dados para servidor");
			this.dao.updateProduct(product, response => {
				console.debug('-----------')
				console.debug('executando fila de', pendentCallbacksKey)
				this[pendentCallbacksKey].forEach(c => {
					console.debug('executando', c);
					c(response);
					console.debug('-----------')
				});
				/* Limpa fila de callbacks */
				this[pendentCallbacksKey] = [];
			});
		}, 3000);
	}

	/*	
	{
		itemId: e.target.dataset.itemId,
		field: e.target.dataset.field,
		value: e.target.value
	}
	 */
	adminChangeProductValue(update, callback){
		// console.log('[update]', update);
		
		let isAValidUpate;
		if(update.field == "name" && !this.isNameUnique({
			id: update.itemId,
			name: update.value
		})){
			isAValidUpate = false;
		} else {
			isAValidUpate = true;
		}

		this.setState(prevState => {
			// console.log('prevState', prevState);
			prevState.products.map(p => {
				if (p.id == update.itemId){
					if (!isAValidUpate){
						p.lastValidValue = p[update.field];
					} else {
						/* Este if previne de atualizar um outro campo e tornar o nome
						inválido válido, apagando o lastValidValue. Trabalha em conjunto
						com o onFocusOut no input */
						if (update.field == "name")
							delete p.lastValidValue;
					}
					p[update.field] = update.value;
				}
				return p;
			})
			return prevState.products.sort(this.sortByCategory);
		},() => {
			if (!isAValidUpate)
				return callback && callback(isAValidUpate);

			let updatedProduct = this.state.products.filter(e => e.id == update.itemId)[0];
			this.updateProductInDatabase(updatedProduct, response => {
				// console.log('response from server:', response);
				callback && callback(response.sucess);
			});
		});
		// }, () => console.log("[Item in state]", this.state.products.filter(e => e.id == update.itemId)));

		// }, x => console.log(this.state.products.filter(e => e.id == update.itemId)));
	}

	/* Pega o valor do lastValidValue e coloca no value 
		Bug/comportamento: Se o usuário digitar um valor inválido
		no campo name (que deve ser único), deixar lá e tentar
		atualizar outro campo do mesmo produto, este campo ficará
		com o lastValidValue, no caso, o name.
	*/
	adminRevertUpdate(update, callback){
		this.setState(prevState => {
			prevState.products.map(p => {
				if (p.id == update.itemId){
					// console.log('comparando', p.lastValidValue, "com" ,p[update.field])
					if(p.lastValidValue && p.lastValidValue != p[update.field]){
						console.log("Valor inválido deixado, revertendo...", update);
						p[update.field] = p.lastValidValue;
					}
				}
				return p;
			})
		})
	}

	addEmptyProduct() {
		let product = this.getEmptyProduct();

		if(!this.isNameUnique(product))
			return alert('Preencha os dados do produto primeiro');

		this.setState(prevState => {
			prevState.products.push(product);

			return prevState.products.sort(this.sortByCategory);
		},() => {
			this.dao.insertProduct(product, response => {
				console.log(response);
			})
		})	
	}

	/**
	 * Verifica se já existe algum produto com o nome
	 * @param  {Product}  product 
	 * @return {Boolean}         true se não existe nenhum com o nome ainda
	 */
	isNameUnique(product){
		return !this.state.products.filter(p => p.name.toLowerCase().trim() == product.name.toLowerCase().trim() && p.id != product.id).length;
	}

	getNextProductId(){
		return (this.state.products.map(p => p.id).reduce((prev, current) => (prev > current) ? prev : current)) + 1;
	}

	getEmptyProduct(){
		return ({
			id: this.getNextProductId(),
			category: "Default",
			price: "",
			quantity: "",
			name: ""
		})
	}

	handleBuy(itemId){
		/*
		Não sei por que funciona...
		achei que precisaria retornar um objeto com o field que
		quero atualizar, mas estou retornando um array e ta tudo blz,
		os outros fields de state não são perdidos, para minha surpresa.
		Espero entender o porquẽ um dia.
		 */
		this.setState(prevState => {
			return prevState.products.map(p => {
				if (p.id == itemId){
					if (p.quantity > 0){
						p.quantity -= 1;
					}
				}
				return p;
			})
		// })
		}, () => this.updateProductInDatabase(this.state.products.filter(p => p.id === itemId)[0]))
	}

	changeSearchFilter(filterSearch){
		this.setState({filterSearch});
	}

	changeStockOnlyFilter(filterStockOnly){
		this.setState({filterStockOnly});
	}

	render() {
		let headers = ["Name", 
					   "Price", 
					   "Qnt",
					   "Buy"];
		let adminHeaders = ["Category",
						   	"Name", 
						   	"Price", 
						   	"Qnt"];


		// console.log(this.state);
		let products = this.state.products.filter(p => {
			return	(
				p.name.toLowerCase().includes(this.state.filterSearch.toLowerCase())
				&& 
				/*
				NÃO FUNCIONA: (this.state.filterStockOnly && p.stocked === true || true)
				Porque se filterStockOnly for true, ele vai testar o p.stocked === true e
				caso ele dê falso (deveríamos retornar false), ele cai no ||, enviando 
				true de qualquer maneira. Tem que ser operador ternário aqui mesmo
				 */
				(this.state.filterStockOnly ? p.quantity > 0 : true)
			)
		});


		let schemaArray = [
			{header: "Name", "productField": "name"},
			{header: "Price", "productField": "price"},
			{header: "Quantity", "productField": "quantity"},
			{header: "Buy", "productField": "buy"},
		];

		let schemaAdminArray = [
			{header: "Id", "productField": "id"},
			{header: "Category", "productField": "category"},
			{header: "Name", "productField": "name"},
			{header: "Price", "productField": "price"},
			{header: "Quantity", "productField": "quantity"}
		];

		let barStyle = {
			backgroundColor: "#d9edf7",
		    padding: "7px",
		    textAlign: "center",
		}

		return (
			<div className="container">
				<br/>
				<br/>
				<div className="row justify-content-md-center">
					<div className="col-md-auto">
						<h1 style={barStyle}>Simple Stock Control</h1>
						<SearchBlock search={this.state.filterSearch}
									 changeSearchFilter={this.changeSearchFilter}
									 stockOnly={this.state.filterStockOnly}
									 changeStockOnlyFilter={this.changeStockOnlyFilter} />
						<br/>
						<ProductTable
									scheme={schemaArray}
									headers={headers}
									products={products} 
									handleBuy={this.handleBuy} />
					</div>
				</div>
				<hr/>
				<div className="row justify-content-md-center">
					<Admin products={products}
						   adminUpdateProduct={this.adminUpdateProduct}
						   barStyle={barStyle}>
				   		   	<ProductTable
				   		   		scheme={schemaAdminArray}
					   			adminChangeProductValue={this.adminChangeProductValue}
								headers={adminHeaders}
								products={products} 
								handleBuy={this.handleBuy} 
								/* Admin */
					   			isAdmin={true}
								addEmptyProduct={this.addEmptyProduct}
								adminRevertUpdate={this.adminRevertUpdate} />
					</Admin>
				</div>
			</div>
		)
	}
}
