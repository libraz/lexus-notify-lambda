import AWS from 'aws-sdk';
import moment from 'moment';
import { Notify } from 'line-api';
import Lexus from './lib/Lexus';

// eslint-disable-next-line import/prefer-default-export
export const lexusNotify = async (event) => {
	let currentItems;
	try {
		const lexus = new Lexus('LC');
		currentItems = await lexus.getCars();
	} catch (e) {
		return {
			statusCode: 400,
			body: JSON.stringify({
				message: e.message
			})
		};
	}

	const getDynamoClient = () => {
		if (!event || ('isOffline' in event && event.isOffline)) {
			return new AWS.DynamoDB.DocumentClient({
				region: 'ap-northeast-1',
				endpoint: 'http://localhost:3030'
			});
		}

		return new AWS.DynamoDB.DocumentClient({
			region: 'ap-northeast-1'
		});
	};
	const dynamodb = getDynamoClient();

	const archiveItems = new Set();
	try {
		const params = {
			TableName: 'lexus_items',
			FilterExpression: 'attribute_not_exists(deletedAt) or deletedAt = :null',
			ExpressionAttributeValues: {
				':null': null
			}
		};

		const scan = async () => {
			const result = await dynamodb.scan(params).promise();

			result.Items.forEach((item) => {
				archiveItems.add(item.id);
			});

			if (result.LastEvaluatedKey) {
				params.ExclusiveStartKey = result.LastEvaluatedKey;
				await scan();
			}
		};
		await scan();
	} catch (e) {
		console.error(`${JSON.stringify(e)}`);
		return {
			statusCode: 400,
			body: JSON.stringify({
				message: e.message
			})
		};
	}

	const newItems = [];
	await Promise.all(
		currentItems.map(async (item) => {
			archiveItems.delete(item.id);
			const result = await dynamodb
				.get({
					TableName: 'lexus_items',
					Key: {
						id: item.id
					}
				})
				.promise();
			if (!Object.keys(result).length) {
				await dynamodb
					.put({
						TableName: 'lexus_items',
						Item: item
					})
					.promise();
				newItems.push(item);
			}
		})
	);

	await Promise.all(
		Array.from(archiveItems).map(async (itemId) => {
			await dynamodb
				.update({
					TableName: 'lexus_items',
					Key: {
						id: itemId
					},
					ExpressionAttributeNames: {
						'#deletedAt': 'deletedAt'
					},
					ExpressionAttributeValues: {
						':deletedAt': moment().unix()
					},
					UpdateExpression: 'SET #deletedAt = :deletedAt'
				})
				.promise();
		})
	);

	const matchedItems = newItems
		.filter((item) => {
			return item.price < 1100;
		})
		.filter((item) => {
			return item.modelYear >= 2018;
		})
		.filter((item) => {
			return !!item.bodyColorCode.match(/^(3T5|223|083)$/);
		});

	const notify = new Notify({
		token: process.env.LINE_TOKEN
	});

	await Promise.all(
		matchedItems.map(async (car) => {
			await notify.send({
				message: `${car.name}\n${car.bodyColorText}/${car.modelYear}年/${car.mileage}km\n${car.price}万円/${car.region}\n${car.detailUrl}`,
				image: { fullsize: car.imageUrl, thumbnail: car.thumbnailUrl }
			});
		})
	);

	return {
		statusCode: 200,
		body: JSON.stringify({
			currentItemsCount: currentItems.length,
			newItemsCount: newItems.length,
			deletedItemCount: archiveItems.size,
			matchedItemsCount: matchedItems.length
		})
	};
};
