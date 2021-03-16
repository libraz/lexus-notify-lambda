import cheerio from 'cheerio';
import axios from 'axios';
import moment from 'moment';

export default class Lexus {
	constructor(category) {
		this.category = category || 'LC';
		this.targetUrl = `https://cpo.lexus.jp/cposearch/result_list?Cn=${this.category}`;
		this.init();
	}

	init() {
		this.cheerio = null;
	}

	async request() {
		const res = await axios.get(this.targetUrl);
		this.cheerio = cheerio.load(res.data);
	}

	async getCars() {
		await this.request();
		if (!this.cheerio) return null;
		const $ = this.cheerio;

		const cars = [];

		$('#table-result tbody').each((idx, element) => {
			const car = {
				id: null,
				name: null,
				thumbnailUrl: null,
				searchCode: null,
				detailUrl: null,
				price: null,
				totalPrice: null,
				modelYear: null,
				inspectionYear: null,
				inspectionMonth: null,
				mileage: null,
				bodyColorText: null,
				bodyColorCode: null,
				dealer: null,
				region: null,
				deletedAt: null,
				createdAt: moment().unix()
			};

			car.name = $(element)
				.find('.name')
				.text()
				.replace(/\s+$/, '')
				.replace(/パッケージ/, '-PKG')
				.replace(/\s(package|pkg)/i, '-PKG');

			const thumbnailUrl = $(element).find('.thumbnail img').attr('src');
			if (thumbnailUrl) {
				const url = new URL(thumbnailUrl, this.targetUrl);
				car.thumbnailUrl = url.toString();
				car.imageUrl = car.thumbnailUrl.replace(/M\.jpg$/, 'L.jpg');
			}

			const detailUrl = $(element).find('.thumbnail a').attr('href');
			if (detailUrl) {
				const url = new URL(detailUrl, this.targetUrl);
				car.searchCode = url.searchParams.get('Id');
				car.id = car.searchCode;
				car.detailUrl = url.toString();
			}

			const priceText = $(element).find('.base-price.pc-cell').text();
			if (priceText) {
				const m1 = priceText.match(/本体([\d,.]+)万円/);
				if (m1) car.price = parseInt(m1[1].replace(/[,]/, ''), 10);
				const m2 = priceText.match(/総額([\d,.]+)万円/);
				if (m2) car.totalPrice = parseFloat(m2[1].replace(/[,]/, ''), 10);
			}
			const modelYearText = $(element).find('.model-year.pc-cell').text();
			if (modelYearText) {
				const m1 = modelYearText.match(/(\d{4})年/);
				if (m1) car.modelYear = parseInt(m1[1], 10);
			}
			const inspectionText = $(element).find('.inspection.pc-cell').text();
			if (inspectionText) {
				const m1 = inspectionText.match(/(\d{4})年/);
				if (m1) car.inspectionYear = parseInt(m1[1], 10);
				const m2 = inspectionText.match(/(\d{1,2})月/);
				if (m2) car.inspectionMonth = parseInt(m2[1], 10);
			}
			const mileageText = $(element).find('.mileage').text();
			if (mileageText) {
				const m1 = mileageText.match(/([\d,]+)km/);
				if (m1) car.mileage = parseInt(m1[1].replace(/[,.]/, ''), 10);
			}
			const bodyColorText = $(element).find('.body-color.pc-cell').text().replace(/\s/g, '');
			if (bodyColorText) {
				car.bodyColorText = bodyColorText.replace(/\(\w+\)/, '');
				const m1 = bodyColorText.match(/\((\w+)\)/);
				if (m1) car.bodyColorCode = m1[1].replace(/\s/, '');
			}

			const dealer = $(element).find('.tel.pc-cell .dealer').text();
			if (dealer) car.dealer = dealer.replace(/ＣＰＯ/, 'CPO');

			const region = $(element).find('.tel.pc-cell .region').text();
			if (region) car.region = region.replace(/[()（）]/g, '');
			cars.push(car);
		});
		return cars;
	}
}
