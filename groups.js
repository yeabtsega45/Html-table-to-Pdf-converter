import http from 'http';

import _ from 'underscore';
import { Meteor } from 'meteor/meteor';
import { Match, check } from 'meteor/check';
import { Email } from 'meteor/email';

import { mountIntegrationQueryBasedOnPermissions } from '../../../integrations/server/lib/mountQueriesBasedOnPermission';
import { Subscriptions, Rooms, Messages, Users } from '../../../models/server';
import { Integrations, Uploads } from '../../../models/server/raw';
import { FileUpload } from '../../../file-upload';
import {
	hasPermission,
	hasAtLeastOnePermission,
	canAccessRoom,
	hasAllPermission,
	roomAccessAttributes,
} from '../../../authorization/server';
import { normalizeMessagesForUser } from '../../../utils/server/lib/normalizeMessagesForUser';
import { API } from '../api';
import { Team } from '../../../../server/sdk';
import { findUsersOfRoom } from '../../../../server/lib/findUsersOfRoom';
import * as Mailer from '../../../mailer';
import { settings } from '../../../settings/server';

// const fs = require('fs');

const PDFDocument = require('pdfkit');

export function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendv1PDFEmail(buffers, param) {
	await sleep(1000);
	const html = Mailer.getHeader() + settings.get('vertiv_email_template').toString().replace('{{body}}', param.text) + Mailer.getFooter();
	Email.send({
		from: settings.get('From_Email'),
		to: param.to,
		cc: param.cc,
		subject: `${param.subject} `,
		text: param.text,
		html,
		attachments: [
			{
				filename: `${param.call_no}.pdf`,
				content: buffers,
				// path: `${param.call_no}.pdf`,
				contentType: 'application/pdf',
			},
		],
	});
	const room = Rooms.findOneByName('general');
	if (!room.customFields) {
		room.customFields = {};
	}
	room.customFields[param.call_no] = {
		filename: `${param.call_no}.pdf`,
		content: buffers.toString('base64'),
		// path: `${param.call_no}.pdf`,
		contentType: 'application/pdf',
	};
	Rooms.setCustomFieldsById(room._id, room.customFields);

	// Meteor.runAsUser(this.userId ? this.userId : Users.findOneByUsernameIgnoringCase('mona')._id, () => {
	// 	Meteor.call('saveRoomSettings', room._id, 'roomCustomFields', room.customFields);
	// });
}

export async function uploadPDF(buffers, param) {
	await sleep(1000);
	const room = Rooms.findOneByName(param.call_no);
	const monaUser = Users.findOneByUsernameIgnoringCase('mona');
	const fileStore = FileUpload.getStore('Uploads');
	const fields = {
		file: '',
		filename: `${param.call_no}.pdf`,
		encoding: 'UTF-8',
		mimetype: 'application/pdf',
		fileBuffer: buffers,
	};

	const details = {
		name: `${param.call_no}.pdf`,
		size: Buffer.byteLength(buffers),
		type: 'application/pdf',
		rid: room.rid,
		userId: monaUser._id,
	};
	const uploadedFile = fileStore.insertSync(details, buffers);
	Meteor.call('sendFileMessage', this.urlParams.rid, null, uploadedFile, fields);
}

export function pdfRow1Details(doc, param) {
	const leftTextAlign = {
		width: 150,
		align: 'left',
	};
	doc.font('Times-Bold').fontSize(8);
	doc.text('FSR Number :', 26, 66, leftTextAlign);
	doc.strokeColor('#000000').rect(22, 60, 378, 20).stroke().rect(400, 60, 170, 20).stroke();
	doc.text('FSR Date :', 404, 66, leftTextAlign);
	const paramObj = param.params ? JSON.parse(param.params) : undefined;
	doc.font('Times-Roman').fontSize(8);
	doc.text(paramObj?.fsr_number, 90, 66, leftTextAlign);
	doc.text(param.completion_date, 485, 66, leftTextAlign);
}

export function pdfRow2Details(doc, param) {
	const leftTextAlign = {
		width: 150,
		align: 'left',
	};
	const fristleftTextAlign = {
		width: 120,
		align: 'left',
	};
	const secondleftTextAlign = {
		width: 140,
		align: 'left',
	};
	doc.strokeColor('#000000').rect(22, 80, 548, 120).stroke();
	doc.moveTo(211, 80).lineTo(211, 200).stroke();
	doc.moveTo(400, 80).lineTo(400, 200).stroke();
	doc.font('Times-Bold').fontSize(8);
	doc.text('Customer Name :', 26, 86, leftTextAlign);
	doc.text('Address :', 26, 106, leftTextAlign);
	doc.text('Contact :', 26, 186, leftTextAlign);

	doc.text('Service Type :', 215, 86, leftTextAlign);
	doc.text('Call Number :', 215, 106, leftTextAlign);
	doc.text('Model :', 215, 126, leftTextAlign);
	doc.text('Serial Number :', 215, 146, leftTextAlign);
	doc.text('Rating :', 215, 166, leftTextAlign);
	doc.text('Product Group :', 215, 186, leftTextAlign);

	doc.text('Contract No. :', 404, 86, leftTextAlign);
	doc.text('Equipment Status :', 404, 106, leftTextAlign);
	doc.text('Service Branch :', 404, 126, leftTextAlign);
	doc.text('Service Provider :', 404, 146, leftTextAlign);
	doc.text('Engineer Name :', 404, 166, leftTextAlign);
	doc.text('Engineer contact No. :', 404, 186, leftTextAlign);

	// const paramObj = param.params ? JSON.parse(param.params) : undefined;
	doc.font('Times-Roman').fontSize(7);
	doc.text(param.customer_name, 90, 86, fristleftTextAlign);
	let addressContent = '';
	if (param.customer_address1?.length > 0) {
		addressContent = `${addressContent}${param.customer_address1}\n`;
	}
	if (param.customer_address2?.length > 0) {
		addressContent = `${addressContent}${param.customer_address2}\n`;
	}
	if (param.customer_address3?.length > 0) {
		addressContent = `${addressContent}${param.customer_address3}\n`;
	}
	if (param.customer_city?.length > 0) {
		addressContent = `${addressContent}${param.customer_city}\n`;
	}
	if (param.customer_state?.length > 0) {
		addressContent = `${addressContent}${param.customer_state} - ${param.customer_pincode}`;
	}
	doc.text(addressContent, 90, 106, {
		height: 75,
		width: 120,
		align: 'left',
	});
	doc.text(param.contact, 90, 186, fristleftTextAlign);

	doc.text(param.servicetype, 280, 86, secondleftTextAlign);
	doc.text(param.call_no, 280, 106, secondleftTextAlign);
	doc.text(param.product_model, 280, 126, secondleftTextAlign);
	doc.text(param.product_serialno, 280, 146, secondleftTextAlign);
	doc.text(param.product_rating, 280, 166, secondleftTextAlign);
	doc.text(param.product_group, 280, 186, secondleftTextAlign);

	doc.text(param.contract_no, 485, 86, fristleftTextAlign);
	doc.text(param.equipment_status, 485, 106, fristleftTextAlign);
	doc.text(param.servicebranch, 485, 126, fristleftTextAlign);
	doc.text(param.serviceprovider, 485, 146, fristleftTextAlign);
	doc.text(param.engineername, 485, 166, fristleftTextAlign);
	doc.text(param.call_engineer_mobilenumber, 485, 186, fristleftTextAlign);
}

export function pdfRow3Details(doc, param) {
	const leftTextAlign = {
		width: 200,
		align: 'left',
	};
	doc.font('Times-Bold').fontSize(8);
	doc.strokeColor('#000000').rect(22, 200, 548, 20).stroke();
	doc.moveTo(294, 200).lineTo(294, 220).stroke();
	doc.text('Problem statement :', 26, 206, leftTextAlign);
	doc.text('Fault Code:', 298, 206, leftTextAlign);
	doc.font('Times-Roman').fontSize(7);
	doc.text(param.problemstatement, 100, 206, {
		height: 18,
		width: 200,
		align: 'left',
	});
	doc.text(param.faultcode, 360, 206, leftTextAlign);
}

export function pdfRow4Details(doc, param) {
	const leftTextAlign = {
		width: 300,
		align: 'left',
	};
	const centerTextAlign = {
		width: 137,
		align: 'center',
	};
	doc.font('Times-Bold').fontSize(11);
	doc.strokeColor('#000000').rect(22, 220, 548, 20).stroke();
	doc.strokeColor('#000000').rect(22, 240, 548, 20).stroke();
	doc.moveTo(158, 240).lineTo(158, 260).stroke();
	doc.moveTo(294, 240).lineTo(294, 260).stroke();
	doc.moveTo(433, 240).lineTo(433, 260).stroke();
	doc.text('Site Assessment / Safety Risk Assessment :', 26, 224, leftTextAlign);
	doc.fontSize(8).text('Hazard', 22, 245, centerTextAlign);
	doc.fontSize(8).text('Level of Risk', 158, 245, centerTextAlign);
	doc.fontSize(8).text('Can work proceed safely?', 294, 245, centerTextAlign);
	doc.fontSize(8).text('Detail safety measures put in place?', 433, 245, centerTextAlign);
	doc.font('Times-Roman').fontSize(8);
	const paramObj = param.params ? JSON.parse(param.params) : undefined;
	const saDetailsAlign = {
		// underline: true,
		width: 130,
		align: 'left',
	};
	const saRiskAlign = {
		// underline: true,
		width: 137,
		align: 'center',
	};
	let yval = 252;
	const dummyKey = {};
	for (let i = 0; i < paramObj.formdata?.length; i++) {
		if (paramObj.formdata[i]) {
			for (const [key, value] of Object.entries(paramObj.formdata[i])) {
				const keyValueArray = key.split(' - ');
				if (keyValueArray.length > 1) {
					const saKey = keyValueArray[0];
					const saColTitle = keyValueArray[1].toLowerCase();
					let sayval = 0;
					if (dummyKey[saKey]) {
						sayval = dummyKey[saKey];
					} else {
						yval += 20;
						dummyKey[saKey] = yval;
						sayval = yval;
						doc.text(saKey, 26, sayval, saDetailsAlign).moveDown();
					}
					let saxval = 22; // default
					if (saColTitle.indexOf('risk') !== -1) {
						saxval = 158;
					} else if (saColTitle.indexOf('proceed') !== -1) {
						saxval = 294;
					} else if (saColTitle.indexOf('measures') !== -1) {
						saxval = 433;
					}
					doc.text(value, saxval, sayval, saRiskAlign).moveDown();
				}
			}
		}
	}
	doc
		.strokeColor('#000000')
		.rect(22, 260, 548, yval - 240)
		.stroke();
	doc
		.moveTo(158, 260)
		.lineTo(158, yval + 20)
		.stroke();
	doc
		.moveTo(294, 260)
		.lineTo(294, yval + 20)
		.stroke();
	doc
		.moveTo(433, 260)
		.lineTo(433, yval + 20)
		.stroke();
	yval += 20;
	return yval;
}

export function pdfRow5Details(doc, param, yval) {
	const leftTextAlign = {
		width: 150,
		align: 'left',
	};
	doc.font('Times-Bold').fontSize(11);
	doc.strokeColor('#000000').rect(22, yval, 548, 20).stroke();
	doc.text('Time Spent :', 26, yval + 4, leftTextAlign);
	yval += 20;
	doc.strokeColor('#000000').rect(22, yval, 548, 60).stroke();

	doc
		.moveTo(211, yval)
		.lineTo(211, yval + 60)
		.stroke();
	doc
		.moveTo(400, yval)
		.lineTo(400, yval + 60)
		.stroke();

	// 26, 215, 404
	doc.font('Times-Bold').fontSize(8);
	doc.text('Travel Start Date/Time :', 26, yval + 6, leftTextAlign);
	doc.text('Reporting Date/Time :', 26, yval + 26, leftTextAlign);
	doc.text('Completion Date/Time :', 26, yval + 46, leftTextAlign);

	doc.text('On Site Time :', 215, yval + 6, leftTextAlign);
	doc.text('Travel Time :', 215, yval + 26, leftTextAlign);
	doc.text('Number of Visits :', 215, yval + 46, leftTextAlign);

	doc.text('Equipment Face :', 404, yval + 6, leftTextAlign);
	doc.text('Break/Idle Time :', 404, yval + 26, leftTextAlign);
	doc.text('Total Time Spent:', 404, yval + 46, leftTextAlign);

	doc.font('Times-Roman').fontSize(8);
	doc.text(param.total_time || '', 120, yval - 15, leftTextAlign);
	doc.text(param.travel_start_time || '', 120, yval + 6, leftTextAlign);
	doc.text(param.reporting_date || '', 120, yval + 26, leftTextAlign);
	doc.text(param.completion_date || '', 120, yval + 46, leftTextAlign);

	doc.text(param.on_site_time || '', 280, yval + 6, leftTextAlign);
	doc.text(param.travel_time || '', 280, yval + 26, leftTextAlign);
	doc.text(param.visits || '', 280, yval + 46, leftTextAlign);

	doc.text(param.equipment_facetime_info[0] || '', 470, yval + 6, leftTextAlign);
	doc.text(param.break_time || '', 470, yval + 26, leftTextAlign);
	doc.text(param.total_time || '', 470, yval + 46, leftTextAlign);

	yval += 60;

	doc.font('Times-Bold').fontSize(11);
	doc.strokeColor('#000000').rect(22, yval, 548, 20).stroke();
	doc.text('Call Activity :', 26, yval + 4, leftTextAlign);
	yval += 20;
	doc.font('Times-Bold').fontSize(8);
	doc.strokeColor('#000000').rect(22, yval, 548, 80).stroke();
	doc.text('Observation :', 26, yval + 4, leftTextAlign);
	yval += 80;
	doc.strokeColor('#000000').rect(22, yval, 548, 80).stroke();
	doc.text('Work Done :', 26, yval + 4, leftTextAlign);
	yval += 80;
	doc.strokeColor('#000000').rect(22, yval, 548, 80).stroke();
	doc.text('Recommendation :', 26, yval + 4, leftTextAlign);
	yval += 80;

	doc.font('Times-Roman').fontSize(8);
	const obsTextAlign = {
		height: 60,
		width: 535,
		align: 'left',
	};
	let obContent = '';
	let wdContent = '';
	let reContent = '';
	// Observation
	for (let i = 0; i < param.workbench.length; i++) {
		const workbenchObj = param.workbench[i];
		if (workbenchObj.activity_type_value?.toLowerCase().indexOf('observation') !== -1) {
			if (workbenchObj.activity_notes?.length > 0) {
				obContent = obContent.length > 0 ? `${obContent}\n` : obContent;
				obContent = `${obContent}[${workbenchObj.activity_date}] ${workbenchObj.activity_notes}`;
			}
		} else if (workbenchObj.activity_type_value?.toLowerCase().indexOf('recommendation') !== -1) {
			if (workbenchObj.activity_notes?.length > 0) {
				reContent = reContent.length > 0 ? `${reContent}\n` : reContent;
				reContent = `${reContent}[${workbenchObj.activity_date}] ${workbenchObj.activity_notes}`;
			}
		} else if (workbenchObj.activity_type_value?.toLowerCase().indexOf('work done') !== -1) {
			if (workbenchObj.activity_notes?.length > 0) {
				wdContent = wdContent.length > 0 ? `${wdContent}\n` : wdContent;
				wdContent = `${wdContent}[${workbenchObj.activity_date}] ${workbenchObj.activity_notes}`;
			}
		}
		doc.text(obContent, 26, yval - 225, obsTextAlign);
		doc.text(wdContent, 26, yval - 145, obsTextAlign);
		doc.text(reContent, 26, yval - 65, obsTextAlign);
	}
}

export function pdfRow6Details(doc, param, yval, isConsumed) {
	const leftTextAlign = {
		width: 150,
		align: 'left',
	};
	doc.font('Times-Bold').fontSize(11);
	doc.strokeColor('#000000').rect(22, yval, 548, 20).stroke();
	doc.text(isConsumed ? 'Part Consumed :' : 'Part Returned :', 26, yval + 4, leftTextAlign);
	yval += 20;
	doc.strokeColor('#000000').rect(22, yval, 548, 20).stroke();
	doc
		.strokeColor('#000000')
		.rect(22, yval + 20, 548, 60)
		.stroke();
	doc
		.moveTo(60, yval)
		.lineTo(60, yval + 80)
		.stroke();
	doc
		.moveTo(170, yval)
		.lineTo(170, yval + 80)
		.stroke();
	doc
		.moveTo(450, yval)
		.lineTo(450, yval + 80)
		.stroke();
	doc.font('Times-Bold').fontSize(8);
	doc.text('Sr No', 26, yval + 4, leftTextAlign);
	doc.text('Part Code', 86, yval + 4, {
		width: 70,
		align: 'center',
	});
	doc.text('Description', 196, yval + 4, {
		width: 250,
		align: 'center',
	});
	doc.text('Quantity', 466, yval + 4, {
		width: 80,
		align: 'center',
	});

	const srTextAlign = {
		width: 40,
		align: 'left',
	};
	const codeTextAlign = {
		width: 100,
		align: 'left',
	};
	const descTextAlign = {
		lineBreak: false,
		width: 250,
		align: 'left',
	};

	// Observation
	let consumedPartNo = 1;
	let returnedPartNo = 1;
	let consumedYval = yval + 25;
	let returnedYval = yval + 25;
	doc.font('Times-Roman').fontSize(8);

	for (let i = 0; i < param.material.length; i++) {
		const materialObj = param.material[i];
		if (!isConsumed && materialObj.part_activity?.toLowerCase().indexOf('spares issued') === -1) {
			doc.text(consumedPartNo, 26, consumedYval, srTextAlign);
			doc.text(materialObj.part_code, 65, consumedYval, codeTextAlign);
			doc.text(materialObj.part_description, 175, consumedYval, descTextAlign);
			doc.text(materialObj.part_qty, 455, consumedYval, codeTextAlign);
			consumedYval += 20;
			consumedPartNo += 1;
		} else if (isConsumed && materialObj.part_activity?.toLowerCase().indexOf('spares issued') !== -1) {
			doc.text(returnedPartNo, 26, returnedYval, srTextAlign);
			doc.text(materialObj.part_code, 65, returnedYval, codeTextAlign);
			doc.text(materialObj.part_description, 175, returnedYval, descTextAlign);
			doc.text(materialObj.part_qty, 455, returnedYval, codeTextAlign);
			returnedYval += 20;
			returnedPartNo += 1;
		}
	}

	yval += 80;
	return yval;
}

export function pdfRow7Details(doc, param, yval) {
	const leftTextAlign = {
		width: 150,
		align: 'left',
	};
	doc.font('Times-Bold').fontSize(8);
	doc.strokeColor('#000000').rect(22, yval, 548, 20).stroke();
	doc.text('Service Billable :', 26, yval + 4, leftTextAlign);
	yval += 20;
	return yval;
}

export function pdfRow8Details(doc, param, yval) {
	const leftTextAlign = {
		width: 250,
		align: 'left',
	};
	doc.font('Times-Bold').fontSize(8);
	doc.strokeColor('#000000').rect(22, yval, 548, 80).stroke();
	doc
		.moveTo(294, yval)
		.lineTo(294, yval + 80)
		.stroke();
	doc.text("Customer's Comment :", 26, yval + 4, leftTextAlign);
	doc.text('Customer Signature :', 298, yval + 4, leftTextAlign);
	const paramObj = param.params ? JSON.parse(param.params) : undefined;

	doc.font('Times-Roman').fontSize(8);
	doc.text(paramObj?.ratings.comment, 26, yval + 15, leftTextAlign);
	doc.image(paramObj?.signature, 350, yval + 5, {
		width: 95,
	});
	yval += 80;
	return yval;
}

export function pdfRow9Details(doc, param, yval) {
	doc.font('Times-Bold').fontSize(8);
	doc.strokeColor('#000000').rect(22, yval, 548, 80).stroke();
	doc.rect(22, yval, 548, 80).fill('#D3D3D3');
	yval += 80;
	return yval;
}

// Returns the private group subscription IF found otherwise it will return the failure of why it didn't. Check the `statusCode` property
export function findPrivateGroupByIdOrName({ params, userId, checkedArchived = true }) {
	if ((!params.roomId || !params.roomId.trim()) && (!params.roomName || !params.roomName.trim())) {
		throw new Meteor.Error('error-room-param-not-provided', 'The parameter "roomId" or "roomName" is required');
	}

	const roomOptions = {
		fields: {
			...roomAccessAttributes,
			t: 1,
			ro: 1,
			name: 1,
			fname: 1,
			prid: 1,
			archived: 1,
			broadcast: 1,
		},
	};
	const room = params.roomId ? Rooms.findOneById(params.roomId, roomOptions) : Rooms.findOneByName(params.roomName, roomOptions);

	if (!room || room.t !== 'p') {
		throw new Meteor.Error('error-room-not-found', 'The required "roomId" or "roomName" param provided does not match any group');
	}

	const user = Users.findOneById(userId, { fields: { username: 1 } });

	if (!canAccessRoom(room, user)) {
		throw new Meteor.Error('error-room-not-found', 'The required "roomId" or "roomName" param provided does not match any group');
	}

	// discussions have their names saved on `fname` property
	const roomName = room.prid ? room.fname : room.name;

	if (checkedArchived && room.archived) {
		throw new Meteor.Error('error-room-archived', `The private group, ${roomName}, is archived`);
	}

	const sub = Subscriptions.findOneByRoomIdAndUserId(room._id, userId, { fields: { open: 1 } });

	return {
		rid: room._id,
		open: sub && sub.open,
		ro: room.ro,
		t: room.t,
		name: roomName,
		broadcast: room.broadcast,
	};
}

API.v1.addRoute(
	'groups.addAll',
	{ authRequired: true },
	{
		post() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('addAllUserToRoom', findResult.rid, this.bodyParams.activeUsersOnly);
			});

			return API.v1.success({
				group: this.composeRoomWithLastMessage(Rooms.findOneById(findResult.rid, { fields: API.v1.defaultFieldsToExclude }), this.userId),
			});
		},
	},
);

API.v1.addRoute(
	'groups.addModerator',
	{ authRequired: true },
	{
		post() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			const user = this.getUserFromParams();

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('addRoomModerator', findResult.rid, user._id);
			});

			return API.v1.success();
		},
	},
);

API.v1.addRoute(
	'groups.addOwner',
	{ authRequired: true },
	{
		post() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			const user = this.getUserFromParams();

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('addRoomOwner', findResult.rid, user._id);
			});

			return API.v1.success();
		},
	},
);

API.v1.addRoute(
	'groups.addLeader',
	{ authRequired: true },
	{
		post() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});
			const user = this.getUserFromParams();
			Meteor.runAsUser(this.userId, () => {
				Meteor.call('addRoomLeader', findResult.rid, user._id);
			});

			return API.v1.success();
		},
	},
);

// Archives a private group only if it wasn't
API.v1.addRoute(
	'groups.archive',
	{ authRequired: true },
	{
		post() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('archiveRoom', findResult.rid);
			});

			return API.v1.success();
		},
	},
);

API.v1.addRoute(
	'groups.close',
	{ authRequired: true },
	{
		post() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
				checkedArchived: false,
			});

			if (!findResult.open) {
				return API.v1.failure(`The private group, ${findResult.name}, is already closed to the sender`);
			}

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('hideRoom', findResult.rid);
			});

			return API.v1.success();
		},
	},
);

API.v1.addRoute(
	'groups.counters',
	{ authRequired: true },
	{
		get() {
			const access = hasPermission(this.userId, 'view-room-administration');
			const params = this.requestParams();
			let user = this.userId;
			let room;
			let unreads = null;
			let userMentions = null;
			let unreadsFrom = null;
			let joined = false;
			let msgs = null;
			let latest = null;
			let members = null;

			if ((!params.roomId || !params.roomId.trim()) && (!params.roomName || !params.roomName.trim())) {
				throw new Meteor.Error('error-room-param-not-provided', 'The parameter "roomId" or "roomName" is required');
			}

			if (params.roomId) {
				room = Rooms.findOneById(params.roomId);
			} else if (params.roomName) {
				room = Rooms.findOneByName(params.roomName);
			}

			if (!room || room.t !== 'p') {
				throw new Meteor.Error('error-room-not-found', 'The required "roomId" or "roomName" param provided does not match any group');
			}

			if (room.archived) {
				throw new Meteor.Error('error-room-archived', `The private group, ${room.name}, is archived`);
			}

			if (params.userId) {
				if (!access) {
					return API.v1.unauthorized();
				}
				user = params.userId;
			}
			const subscription = Subscriptions.findOneByRoomIdAndUserId(room._id, user);
			const lm = room.lm ? room.lm : room._updatedAt;

			if (typeof subscription !== 'undefined' && subscription.open) {
				unreads = Messages.countVisibleByRoomIdBetweenTimestampsInclusive(subscription.rid, subscription.ls || subscription.ts, lm);
				unreadsFrom = subscription.ls || subscription.ts;
				userMentions = subscription.userMentions;
				joined = true;
			}

			if (access || joined) {
				msgs = room.msgs;
				latest = lm;
				members = room.usersCount;
			}

			return API.v1.success({
				joined,
				members,
				unreads,
				unreadsFrom,
				msgs,
				latest,
				userMentions,
			});
		},
	},
);

// Create Private Group
API.v1.addRoute(
	'groups.create',
	{ authRequired: true },
	{
		post() {
			if (!hasPermission(this.userId, 'create-p')) {
				return API.v1.unauthorized();
			}

			if (!this.bodyParams.name) {
				return API.v1.failure('Body param "name" is required');
			}

			if (this.bodyParams.members && !_.isArray(this.bodyParams.members)) {
				return API.v1.failure('Body param "members" must be an array if provided');
			}

			if (this.bodyParams.customFields && !(typeof this.bodyParams.customFields === 'object')) {
				return API.v1.failure('Body param "customFields" must be an object if provided');
			}
			if (this.bodyParams.extraData && !(typeof this.bodyParams.extraData === 'object')) {
				return API.v1.failure('Body param "extraData" must be an object if provided');
			}

			const readOnly = typeof this.bodyParams.readOnly !== 'undefined' ? this.bodyParams.readOnly : false;

			let id;

			Meteor.runAsUser(this.userId, () => {
				id = Meteor.call(
					'createPrivateGroup',
					this.bodyParams.name,
					this.bodyParams.members ? this.bodyParams.members : [],
					readOnly,
					this.bodyParams.customFields,
					this.bodyParams.extraData,
				);
			});

			return API.v1.success({
				group: this.composeRoomWithLastMessage(Rooms.findOneById(id.rid, { fields: API.v1.defaultFieldsToExclude }), this.userId),
			});
		},
	},
);

API.v1.addRoute(
	'groups.delete',
	{ authRequired: true },
	{
		post() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
				checkedArchived: false,
			});

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('eraseRoom', findResult.rid);
			});

			return API.v1.success();
		},
	},
);

API.v1.addRoute(
	'groups.files',
	{ authRequired: true },
	{
		get() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
				checkedArchived: false,
			});
			const addUserObjectToEveryObject = (file) => {
				if (file.userId) {
					file = this.insertUserObject({ object: file, userId: file.userId });
				}
				return file;
			};

			const { offset, count } = this.getPaginationItems();
			const { sort, fields, query } = this.parseJsonQuery();

			const ourQuery = Object.assign({}, query, { rid: findResult.rid });

			const files = Promise.await(
				Uploads.find(ourQuery, {
					sort: sort || { name: 1 },
					skip: offset,
					limit: count,
					fields,
				}).toArray(),
			);

			return API.v1.success({
				files: files.map(addUserObjectToEveryObject),
				count: files.length,
				offset,
				total: Promise.await(Uploads.find(ourQuery).count()),
			});
		},
	},
);

API.v1.addRoute(
	'groups.getIntegrations',
	{ authRequired: true },
	{
		get() {
			if (
				!hasAtLeastOnePermission(this.userId, [
					'manage-outgoing-integrations',
					'manage-own-outgoing-integrations',
					'manage-incoming-integrations',
					'manage-own-incoming-integrations',
				])
			) {
				return API.v1.unauthorized();
			}

			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
				checkedArchived: false,
			});

			let includeAllPrivateGroups = true;
			if (typeof this.queryParams.includeAllPrivateGroups !== 'undefined') {
				includeAllPrivateGroups = this.queryParams.includeAllPrivateGroups === 'true';
			}

			const channelsToSearch = [`#${findResult.name}`];
			if (includeAllPrivateGroups) {
				channelsToSearch.push('all_private_groups');
			}

			const { offset, count } = this.getPaginationItems();
			const { sort, fields: projection, query } = this.parseJsonQuery();

			const ourQuery = Object.assign(mountIntegrationQueryBasedOnPermissions(this.userId), query, {
				channel: { $in: channelsToSearch },
			});
			const cursor = Integrations.find(ourQuery, {
				sort: sort || { _createdAt: 1 },
				skip: offset,
				limit: count,
				projection,
			});

			const integrations = Promise.await(cursor.toArray());
			const total = Promise.await(cursor.count());

			return API.v1.success({
				integrations,
				count: integrations.length,
				offset,
				total,
			});
		},
	},
);

API.v1.addRoute(
	'groups.history',
	{ authRequired: true },
	{
		get() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
				checkedArchived: false,
			});

			let latestDate = new Date();
			if (this.queryParams.latest) {
				latestDate = new Date(this.queryParams.latest);
			}

			let oldestDate = undefined;
			if (this.queryParams.oldest) {
				oldestDate = new Date(this.queryParams.oldest);
			}

			const inclusive = this.queryParams.inclusive || false;

			let count = 20;
			if (this.queryParams.count) {
				count = parseInt(this.queryParams.count);
			}

			let offset = 0;
			if (this.queryParams.offset) {
				offset = parseInt(this.queryParams.offset);
			}

			const unreads = this.queryParams.unreads || false;

			const showThreadMessages = this.queryParams.showThreadMessages !== 'false';

			const result = Meteor.call('getChannelHistory', {
				rid: findResult.rid,
				latest: latestDate,
				oldest: oldestDate,
				inclusive,
				offset,
				count,
				unreads,
				showThreadMessages,
			});

			if (!result) {
				return API.v1.unauthorized();
			}

			return API.v1.success(result);
		},
	},
);

API.v1.addRoute(
	'groups.info',
	{ authRequired: true },
	{
		get() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
				checkedArchived: false,
			});

			return API.v1.success({
				group: this.composeRoomWithLastMessage(Rooms.findOneById(findResult.rid, { fields: API.v1.defaultFieldsToExclude }), this.userId),
			});
		},
	},
);

API.v1.addRoute(
	'groups.invite',
	{ authRequired: true },
	{
		post() {
			const { roomId = '', roomName = '' } = this.requestParams();
			const idOrName = roomId || roomName;
			if (!idOrName.trim()) {
				throw new Meteor.Error('error-room-param-not-provided', 'The parameter "roomId" or "roomName" is required');
			}

			const { _id: rid, t: type } = Rooms.findOneByIdOrName(idOrName) || {};

			if (!rid || type !== 'p') {
				throw new Meteor.Error('error-room-not-found', 'The required "roomId" or "roomName" param provided does not match any group');
			}

			const users = this.getUserListFromParams();

			if (!users.length) {
				throw new Meteor.Error('error-empty-invite-list', 'Cannot invite if no valid users are provided');
			}

			Meteor.runAsUser(this.userId, () => Meteor.call('addUsersToRoom', { rid, users: users.map((u) => u.username) }));

			return API.v1.success({
				group: this.composeRoomWithLastMessage(Rooms.findOneById(rid, { fields: API.v1.defaultFieldsToExclude }), this.userId),
			});
		},
	},
);

API.v1.addRoute(
	'groups.kick',
	{ authRequired: true },
	{
		post() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			const user = this.getUserFromParams();

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('removeUserFromRoom', { rid: findResult.rid, username: user.username });
			});

			return API.v1.success();
		},
	},
);

API.v1.addRoute(
	'groups.leave',
	{ authRequired: true },
	{
		post() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('leaveRoom', findResult.rid);
			});

			return API.v1.success();
		},
	},
);

// List Private Groups a user has access to
API.v1.addRoute(
	'groups.list',
	{ authRequired: true },
	{
		get() {
			const { offset, count } = this.getPaginationItems();
			const { sort, fields } = this.parseJsonQuery();

			// TODO: CACHE: Add Breacking notice since we removed the query param
			const cursor = Rooms.findBySubscriptionTypeAndUserId('p', this.userId, {
				sort: sort || { name: 1 },
				skip: offset,
				limit: count,
				fields,
			});

			const totalCount = cursor.count();
			const rooms = cursor.fetch();

			return API.v1.success({
				groups: rooms.map((room) => this.composeRoomWithLastMessage(room, this.userId)),
				offset,
				count: rooms.length,
				total: totalCount,
			});
		},
	},
);

API.v1.addRoute(
	'groups.listAll',
	{ authRequired: true },
	{
		get() {
			if (!hasPermission(this.userId, 'view-room-administration')) {
				return API.v1.unauthorized();
			}
			const { offset, count } = this.getPaginationItems();
			const { sort, fields, query } = this.parseJsonQuery();
			const ourQuery = Object.assign({}, query, { t: 'p' });

			const cursor = Rooms.find(ourQuery, {
				sort: sort || { name: 1 },
				skip: offset,
				limit: count,
				fields,
			});

			const totalCount = cursor.count();
			const rooms = cursor.fetch();

			return API.v1.success({
				groups: rooms.map((room) => this.composeRoomWithLastMessage(room, this.userId)),
				offset,
				count: rooms.length,
				total: totalCount,
			});
		},
	},
);

API.v1.addRoute(
	'groups.members',
	{ authRequired: true },
	{
		get() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			if (findResult.broadcast && !hasPermission(this.userId, 'view-broadcast-member-list', findResult.rid)) {
				return API.v1.unauthorized();
			}

			const { offset: skip, count: limit } = this.getPaginationItems();
			const { sort = {} } = this.parseJsonQuery();

			check(
				this.queryParams,
				Match.ObjectIncluding({
					status: Match.Maybe([String]),
					filter: Match.Maybe(String),
				}),
			);
			const { status, filter } = this.queryParams;

			const cursor = findUsersOfRoom({
				rid: findResult.rid,
				...(status && { status: { $in: status } }),
				skip,
				limit,
				filter,
				...(sort?.username && { sort: { username: sort.username } }),
			});

			const total = cursor.count();
			const members = cursor.fetch();

			return API.v1.success({
				members,
				count: members.length,
				offset: skip,
				total,
			});
		},
	},
);

API.v1.addRoute(
	'groups.messages',
	{ authRequired: true },
	{
		get() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});
			const { offset, count } = this.getPaginationItems();
			const { sort, fields, query } = this.parseJsonQuery();

			const ourQuery = Object.assign({}, query, { rid: findResult.rid });

			const messages = Messages.find(ourQuery, {
				sort: sort || { ts: -1 },
				skip: offset,
				limit: count,
				fields,
			}).fetch();

			return API.v1.success({
				messages: normalizeMessagesForUser(messages, this.userId),
				count: messages.length,
				offset,
				total: Messages.find(ourQuery).count(),
			});
		},
	},
);
// TODO: CACHE: same as channels.online
API.v1.addRoute(
	'groups.online',
	{ authRequired: true },
	{
		get() {
			const { query } = this.parseJsonQuery();
			if (!query || Object.keys(query).length === 0) {
				return API.v1.failure('Invalid query');
			}

			const ourQuery = Object.assign({}, query, { t: 'p' });

			const room = Rooms.findOne(ourQuery);

			if (room == null) {
				return API.v1.failure('Group does not exists');
			}

			const user = this.getLoggedInUser();

			if (!canAccessRoom(room, user)) {
				throw new Meteor.Error('error-not-allowed', 'Not Allowed');
			}

			const online = Users.findUsersNotOffline({
				fields: {
					username: 1,
				},
			}).fetch();

			const onlineInRoom = [];
			online.forEach((user) => {
				const subscription = Subscriptions.findOneByRoomIdAndUserId(room._id, user._id, {
					fields: { _id: 1 },
				});
				if (subscription) {
					onlineInRoom.push({
						_id: user._id,
						username: user.username,
					});
				}
			});

			return API.v1.success({
				online: onlineInRoom,
			});
		},
	},
);

API.v1.addRoute(
	'groups.open',
	{ authRequired: true },
	{
		post() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
				checkedArchived: false,
			});

			if (findResult.open) {
				return API.v1.failure(`The private group, ${findResult.name}, is already open for the sender`);
			}

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('openRoom', findResult.rid);
			});

			return API.v1.success();
		},
	},
);

API.v1.addRoute(
	'groups.removeModerator',
	{ authRequired: true },
	{
		post() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			const user = this.getUserFromParams();

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('removeRoomModerator', findResult.rid, user._id);
			});

			return API.v1.success();
		},
	},
);

API.v1.addRoute(
	'groups.removeOwner',
	{ authRequired: true },
	{
		post() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			const user = this.getUserFromParams();

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('removeRoomOwner', findResult.rid, user._id);
			});

			return API.v1.success();
		},
	},
);

API.v1.addRoute(
	'groups.removeLeader',
	{ authRequired: true },
	{
		post() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			const user = this.getUserFromParams();

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('removeRoomLeader', findResult.rid, user._id);
			});

			return API.v1.success();
		},
	},
);

API.v1.addRoute(
	'groups.rename',
	{ authRequired: true },
	{
		post() {
			if (!this.bodyParams.name || !this.bodyParams.name.trim()) {
				return API.v1.failure('The bodyParam "name" is required');
			}

			const findResult = findPrivateGroupByIdOrName({
				params: { roomId: this.bodyParams.roomId },
				userId: this.userId,
			});

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('saveRoomSettings', findResult.rid, 'roomName', this.bodyParams.name);
			});

			return API.v1.success({
				group: this.composeRoomWithLastMessage(Rooms.findOneById(findResult.rid, { fields: API.v1.defaultFieldsToExclude }), this.userId),
			});
		},
	},
);

API.v1.addRoute(
	'groups.setCustomFields',
	{ authRequired: true },
	{
		post() {
			if (!this.bodyParams.customFields || !(typeof this.bodyParams.customFields === 'object')) {
				return API.v1.failure('The bodyParam "customFields" is required with a type like object.');
			}

			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('saveRoomSettings', findResult.rid, 'roomCustomFields', this.bodyParams.customFields);
			});

			return API.v1.success({
				group: this.composeRoomWithLastMessage(Rooms.findOneById(findResult.rid, { fields: API.v1.defaultFieldsToExclude }), this.userId),
			});
		},
	},
);

API.v1.addRoute(
	'groups.setDescription',
	{ authRequired: true },
	{
		post() {
			if (!this.bodyParams.hasOwnProperty('description')) {
				return API.v1.failure('The bodyParam "description" is required');
			}

			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('saveRoomSettings', findResult.rid, 'roomDescription', this.bodyParams.description);
			});

			return API.v1.success({
				description: this.bodyParams.description,
			});
		},
	},
);

API.v1.addRoute(
	'groups.setPurpose',
	{ authRequired: true },
	{
		post() {
			if (!this.bodyParams.hasOwnProperty('purpose')) {
				return API.v1.failure('The bodyParam "purpose" is required');
			}

			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('saveRoomSettings', findResult.rid, 'roomDescription', this.bodyParams.purpose);
			});

			return API.v1.success({
				purpose: this.bodyParams.purpose,
			});
		},
	},
);

API.v1.addRoute(
	'groups.setReadOnly',
	{ authRequired: true },
	{
		post() {
			if (typeof this.bodyParams.readOnly === 'undefined') {
				return API.v1.failure('The bodyParam "readOnly" is required');
			}

			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			if (findResult.ro === this.bodyParams.readOnly) {
				return API.v1.failure('The private group read only setting is the same as what it would be changed to.');
			}

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('saveRoomSettings', findResult.rid, 'readOnly', this.bodyParams.readOnly);
			});

			return API.v1.success({
				group: this.composeRoomWithLastMessage(Rooms.findOneById(findResult.rid, { fields: API.v1.defaultFieldsToExclude }), this.userId),
			});
		},
	},
);

API.v1.addRoute(
	'groups.setTopic',
	{ authRequired: true },
	{
		post() {
			if (!this.bodyParams.hasOwnProperty('topic')) {
				return API.v1.failure('The bodyParam "topic" is required');
			}

			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('saveRoomSettings', findResult.rid, 'roomTopic', this.bodyParams.topic);
			});

			return API.v1.success({
				topic: this.bodyParams.topic,
			});
		},
	},
);

API.v1.addRoute(
	'groups.setType',
	{ authRequired: true },
	{
		post() {
			if (!this.bodyParams.type || !this.bodyParams.type.trim()) {
				return API.v1.failure('The bodyParam "type" is required');
			}

			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			if (findResult.t === this.bodyParams.type) {
				return API.v1.failure('The private group type is the same as what it would be changed to.');
			}

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('saveRoomSettings', findResult.rid, 'roomType', this.bodyParams.type);
			});

			return API.v1.success({
				group: this.composeRoomWithLastMessage(Rooms.findOneById(findResult.rid, { fields: API.v1.defaultFieldsToExclude }), this.userId),
			});
		},
	},
);

API.v1.addRoute(
	'groups.setAnnouncement',
	{ authRequired: true },
	{
		post() {
			if (!this.bodyParams.hasOwnProperty('announcement')) {
				return API.v1.failure('The bodyParam "announcement" is required');
			}

			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('saveRoomSettings', findResult.rid, 'roomAnnouncement', this.bodyParams.announcement);
			});

			return API.v1.success({
				announcement: this.bodyParams.announcement,
			});
		},
	},
);

API.v1.addRoute(
	'groups.unarchive',
	{ authRequired: true },
	{
		post() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
				checkedArchived: false,
			});

			Meteor.runAsUser(this.userId, () => {
				Meteor.call('unarchiveRoom', findResult.rid);
			});

			return API.v1.success();
		},
	},
);

API.v1.addRoute(
	'groups.roles',
	{ authRequired: true },
	{
		get() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			const roles = Meteor.runAsUser(this.userId, () => Meteor.call('getRoomRoles', findResult.rid));

			return API.v1.success({
				roles,
			});
		},
	},
);

API.v1.addRoute(
	'groups.moderators',
	{ authRequired: true },
	{
		get() {
			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			const moderators = Subscriptions.findByRoomIdAndRoles(findResult.rid, ['moderator'], {
				fields: { u: 1 },
			})
				.fetch()
				.map((sub) => sub.u);

			return API.v1.success({
				moderators,
			});
		},
	},
);

API.v1.addRoute(
	'groups.setEncrypted',
	{ authRequired: true },
	{
		post() {
			if (!Match.test(this.bodyParams, Match.ObjectIncluding({ encrypted: Boolean }))) {
				return API.v1.failure('The bodyParam "encrypted" is required');
			}

			const findResult = findPrivateGroupByIdOrName({
				params: this.requestParams(),
				userId: this.userId,
			});

			Meteor.call('saveRoomSettings', findResult.rid, 'encrypted', this.bodyParams.encrypted);

			return API.v1.success({
				group: this.composeRoomWithLastMessage(Rooms.findOneById(findResult.rid, { fields: API.v1.defaultFieldsToExclude }), this.userId),
			});
		},
	},
);

API.v1.addRoute(
	'groups.convertToTeam',
	{ authRequired: true },
	{
		post() {
			const { roomId, roomName } = this.requestParams();

			if (!roomId && !roomName) {
				return API.v1.failure('The parameter "roomId" or "roomName" is required');
			}

			const room = findPrivateGroupByIdOrName({
				params: {
					roomId,
					roomName,
				},
				userId: this.userId,
			});

			if (!room) {
				return API.v1.failure('Private group not found');
			}

			if (!hasAllPermission(this.userId, ['create-team', 'edit-room'], room.rid)) {
				return API.v1.unauthorized();
			}

			const subscriptions = Subscriptions.findByRoomId(room.rid, {
				fields: { 'u._id': 1 },
			});

			const members = subscriptions.fetch().map((s) => s.u && s.u._id);

			const teamData = {
				team: {
					name: room.name,
					type: 1,
				},
				members,
				room: {
					name: room.name,
					id: room.rid,
				},
			};

			const team = Promise.await(Team.create(this.userId, teamData));

			return API.v1.success({ team });
		},
	},
);

API.v1.addRoute(
	'notification.send',
	{ authRequired: false },
	{
		post() {
			const param = this.bodyParams;
			console.log('notification.send', param);
			const { type, to, body, subject } = param;
			// "from": record.notification_from,
			// "to": record.	notification_to,
			// "type": record.notification_type,
			// "body": record.body,
			// "subject": record.subject,
			if (type?.toLowerCase().indexOf('email') !== -1) {
				const text = body;
				const html = settings.get('vertiv_email_template').toString().replace('{{body}}', body);
				// const html = `
				// <div style="text-align: center; background: #FFFFFF; border-radius: 5px; padding: 45px 40px;">
				// 	<p style="color: #333333; font-size: 18px; line-height: 24px; margin-bottom: 0;">
				// 	${body}
				// 	</p>
				// </div>
				// <div style="text-align: center; background: #333333; border-radius: 5px; padding: 45px 40px; margin-top: 20px;">
				// 	<h2 style="font-weight: normal; font-size: 22px; color: #e5e5e5; margin: 0; font-family: 'Poppins', sans-serif;"> Do you have a question?</h2>
				// 	<h2 style="color: #e5e5e5; font-size: 13px;">Contact our customer support team</h2>
				// 	<p style="color: #e5e5e5; font-size: 13px; line-height: 18px;">We are available to help you by phone, email or visit our  website and talk to us via chat between 9:00am - 6:00pm IST
				// 	</p>
				// 	<table style="margin: 0 auto;">
				// 		<tbody><tr>
				// 			<td>
				// 			<div style="float: right; padding-top: 25px; font-size: 13px; color: #e5e5e5">
				// 			For Field Service App issues mail to: <a href="mailto:c28a9a9e.vertivco.onmicrosoft.com@amer.teams.ms" style="text-decoration:none; color: #fe5b1b;">
				// 			  c28a9a9e.vertivco.onmicrosoft.com@amer.teams.ms</a>
				// 		  </div>
				// 			</td>
				// 		</tr>
				// 		</tbody>
				// 	</table>
				// </div>`;
				try {
					Mailer.send({
						to,
						from: settings.get('From_Email'),
						subject,
						replyTo: undefined,
						headers: undefined,
						text,
						html,
					});
				} catch (error) {
					console.log('ezhil error', error);
				}
			}
		},
	},
);

API.v1.addRoute(
	'groups.callnotes',
	{ authRequired: false },
	{
		post() {
			const param = this.bodyParams;
			console.log('groups.callnotes', param);
			const callNo = param.callno.toLowerCase();
			if (param.token === 'u6a3fkt40ywp') {
				const managerUser = Users.findOneByEmailAddress(param.manager);
				const enggUser = Users.findOneByEmailAddress(param.user);
				const monaUser = Users.findOneByUsernameIgnoringCase('mona');
				const roomOptions = {
					fields: {
						t: 1,
						ro: 1,
						name: 1,
						fname: 1,
						prid: 1,
						archived: 1,
						broadcast: 1,
					},
				};
				const room = Rooms.findOneByName(callNo, roomOptions);
				if (!room) {
					Meteor.runAsUser(managerUser ? managerUser._id : monaUser._id, () => {
						let members = [];
						if (enggUser && managerUser) {
							members = [enggUser.username, managerUser.username];
						} else if (enggUser) {
							members = [enggUser.username];
						}
						const returned = Meteor.call('createPrivateGroup', callNo, members, false, this.bodyParams.customFields);
						console.log('groups.callnotes  : createPrivateGroup ', callNo, returned);
						Meteor.call('saveNotificationSettings', returned.rid, 'emailNotifications', 'all');
					});
					if (param.productgroup) {
						const supportroom = Rooms.findOneByName(`${callNo}_${param.productgroup.toLowerCase()}`, roomOptions);
						if (!supportroom) {
							Meteor.runAsUser(managerUser ? managerUser._id : monaUser._id, () => {
								let members = [];
								if (enggUser && managerUser) {
									members = [enggUser.username, managerUser.username];
								} else if (enggUser) {
									members = [enggUser.username];
								}
								const returned = Meteor.call(
									'createPrivateGroup',
									`${callNo}_${param.productgroup.toLowerCase()}`,
									members,
									false,
									this.bodyParams.customFields,
								);
								console.log('groups.callnotes  : createPrivateGroup ', `${callNo}_${param.productgroup.toLowerCase()}`, returned);
								Meteor.call('saveNotificationSettings', returned.rid, 'emailNotifications', 'all');
							});
						} else {
							if (enggUser) {
								const supportdata = { rid: supportroom._id };
								supportdata.username = enggUser.username;
								Meteor.runAsUser(enggUser._id, () => {
									Meteor.call('addUserToRoom', supportdata);
									console.log('groups.callnotes  : addUserToRoom ', supportdata);
								});
							}
							if (managerUser.username) {
								const supportdata = { rid: supportroom._id };
								supportdata.username = managerUser.username;
								Meteor.runAsUser(managerUser._id, () => {
									Meteor.call('addUserToRoom', supportdata);
									console.log('groups.callnotes  : addUserToRoom ', supportdata);
								});
							}
						}
					}
				} else {
					// add members
					const data = {};
					data.rid = room._id;
					if (enggUser) {
						data.username = enggUser.username;
						Meteor.runAsUser(enggUser._id, () => {
							Meteor.call('addUserToRoom', data);
							console.log('groups.callnotes  :else addUserToRoom ', data);
						});
					}
					if (managerUser.username) {
						data.username = managerUser.username;
						Meteor.runAsUser(managerUser._id, () => {
							Meteor.call('addUserToRoom', data);
							console.log('groups.callnotes  : esle addUserToRoom ', data);
						});
					}

					if (param.productgroup) {
						const supportroom = Rooms.findOneByName(`${callNo}_${param.productgroup.toLowerCase()}`, roomOptions);
						if (!supportroom) {
							Meteor.runAsUser(managerUser ? managerUser._id : monaUser._id, () => {
								let members = [];
								if (enggUser && managerUser) {
									members = [enggUser.username, managerUser.username];
								} else if (enggUser) {
									members = [enggUser.username];
								}
								const returned = Meteor.call(
									'createPrivateGroup',
									`${callNo}_${param.productgroup.toLowerCase()}`,
									members,
									false,
									this.bodyParams.customFields,
								);
								console.log('groups.callnotes  : createPrivateGroup else ', `${callNo}_${param.productgroup.toLowerCase()}`, returned);
								Meteor.call('saveNotificationSettings', returned.rid, 'emailNotifications', 'all');
							});
						} else {
							if (enggUser) {
								const supportdata = { rid: supportroom._id };
								supportdata.username = enggUser.username;
								Meteor.runAsUser(enggUser._id, () => {
									Meteor.call('addUserToRoom', supportdata);
									console.log('groups.callnotes  : esle2 addUserToRoom ', supportdata);
								});
							}
							if (managerUser.username) {
								const supportdata = { rid: supportroom._id };
								supportdata.username = managerUser.username;
								Meteor.runAsUser(managerUser._id, () => {
									Meteor.call('addUserToRoom', supportdata);
									console.log('groups.callnotes  : esle3 addUserToRoom ', supportdata);
								});
							}
						}
					}
				}
			} else {
				return API.v1.failure('Invalid token');
			}
			return API.v1.success();
		},
	},
);

API.v1.addRoute(
	'notification.report',
	{ authRequired: false },
	{
		post() {
			const param = this.bodyParams;
			const doc = new PDFDocument({ size: 'A4', margin: 20 });
			// doc.pipe(fs.createWriteStream('/Users/mongrovadmin/work/ezhil/output/1.pdf'));
			const buffers = [];
			doc.on('data', buffers.push.bind(buffers));
			doc.on('end', () => {
				sendv1PDFEmail(Buffer.concat(buffers), param);
			});
			// const paramObj = param.params ? JSON.parse(param.params) : undefined;
			// const fontsize = 6;
			doc.fontSize(21);
			// doc.registerFont('katex bold', 'fonts/KaTeX_Main-Bold.ttf', 'KaTeX_Main-Bold');
			doc.font('Times-Bold');
			doc
				.text('Field Service Report', 20, 25, {
					width: 450,
					align: 'left',
				})
				.moveDown();

			const logo =
				'data:image/png;base64,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KcEBwLejQ4iIiIiISHVUcgXdzNYAbgRWDY4iUqYNW63Wsu12++roICIiIiIiEq9yDbqZrUbWnOuZc+kHb2m1Wou22+1Z0UFERERERCRWpRp0M3spcAOwVnQWkYQ2a7Vas9vt9i3RQUREREREJE5lGnQzezFZc96KziISYKtWq/Vou93+SXQQERERERGJUYkG3cyWIWvO14/OIhJoaqvVurvdbv8iOoiIiIiIiKQXPgfdzCYBlwHbR2cRqYDZwHbufkN0EBERERERSasKY9a+ippzkUGTgZn5mEEREREREekjoQ26mb0PeH9kBpEKWg64zMyWiw4iIiIiIiLphG1xN7OpwOVU5Dl4kQq6Htje3WdHBxERERERkfKFrKCb2brAD1BzLjKWrYGTokOIiIiIiEgayRtkM1uR7MT2l6SuLVJDG7ZarYfa7fZt0UFERERERKRcSbe45ye2zwI2T1lXpObmAFPd/froICIiIiIiUp7UW9w/jZpzkW5NAs4wsxdHBxERERERkfIkW0E3sy2B66jGaDeROroS2NHd50UHERERERGR4iVplvPnzs9MVU+koaYBR0aHEBERERGRcpS+gm5mE4DLgB3KriXSB54FNnb3X0QHERERERGRYqVY0T4KNeciRVkUONfMlooOIiIiIiIixSq1QTezNwKfL7OGSB9aG/hmdAgRERERESlWaXPQzWxJskPhdPK0SPFe22q1/txut38THURERERERIpR5gr68cArS7y+SL/7Wn4Ao4iIiIiINEApDXq+tf3wMq4tIs9bATgxOoSIiIiIiBSj8FPczWwScDvw+qKvLSIj2tbdr4sOISIiIiIi41PGCvpRqDkXSenbZjYlOoSIiIiIiIxPoQ26mb0COK7Ia4rIQr0S+FR0CBERERERGZ+iV9C/BSxR8DVFZOE+ZGbrR4cQEREREZHeFdagm9k+wLSiriciXVkE+J6ZFX6uhIiIiIiIpFFIg25mSwFfKeJaItKzjYGDokOIiIiIiEhvilpB/xCwckHXEpHeHWdmi0eHEBERERGR7o27QTezlYAPFpBFRMZvFeCI6BAiIiIiItK9IlbQPwksVcB1RKQYx5jZctEhRERERESkO+Nq0M1sTeDQgrKISDGWBT4WHUJERERERLoz3hX0E8hOjxaRanm/ma0WHUJERERERDrXc4NuZm8A9iowi4gUZwpwXHQIERERERHp3HhW0L8AaOaySHUdYGbrRocQEREREZHOTO7lm8xsY+BaYEaxcWppf2C76BCygMeBo4HHooNUwG7A76NDNI2ZLQ18i5iblCe6+y8C6iZhZm8Htg8o/Tl3L+TvipltQPYaJOXY393npSpmZusBH01VL7GHgXvyH3cP+d9HUv47LoOZnQisFJ1DALjW3U8v+qJmtiFwZNHXHcWd7n5CURczs+OAtYq6Xheuc/eBgLpJBL7/Xu7u5xR1sZ4adLKxausDb3X3fxcVpo7M7ALgEtSkV8UTwA7ufkt0kGhm9hngY2Z2hrv/MzpPk7j7Y2a2FrBxQPnHgfcE1E3lU8DaiWs+CLyrwOutAuxX4PVkQe8A5iSstzL99+f5lJndBcwCLgRudPdngzN1a1dgjegQAsAjQOENOrA66f5u3kR29lZRniPmdWVTYCCgbioHE/Pv9btFXqzrLe75wVO7Ai3gBjNbuchAdePuTwO7ANdEZxGeBHZUcw5mdizZCMRJwHuD4zRVGR82OjHdzBp5OKeZvYn0zTnAOTVsPkTKtDjZ38VDgauB/5rZGWa2u5ktGRtNpBFOB+YG1H2FmW0SULd0ZjYJ2DOg9F+BW4u8YC/PoL+X7EM/wDpkTXpfbyFSk14JTwHm7jdFB4lmZh8HPj3klw42sylBcZrsB8DTAXVXAKYG1E1h36C6A0F1ReriRcDbgZnAfWZ2kZltG5xJpLbc/V/ADUHlo95ry7YNMY+1zCj6kaCuGnQzW4xs68BQrwZmmdmLC0tVQ0Oa9Gujs/Shp4Gd3X1WdJBoZvYR4Phhv7wCsE9AnEZz94eBS4PKN+7N1cwmEjMZ5Lfu/rOAuiJ1tTjZTsprzOxKM1s/OpBITQ0E1d3DzHp9zLnKIj4bzaOEM9m6XUHfG1hxhF9fj6xJH+n3+oaa9BDPALu4+3XRQaKZ2YeBz4/y24enzNJHora579zAbaZbAi8NqBv1ZyjSBNsDd5jZ98ws4u+vSJ1dCDwaUHclstXmxjCzxckORk7tFnf/W9EX7bZBH+tD/vrA9WrS/SmyJr3vG8YEngF2c/e+f7TAzI4CvjTGl7y+qc8cBbsa+E9A3SXJVrCaJOJQl9nAmQF1RZpkItnuyj+Z2acaePNQpBTu/iRwflD5ph18acDSAXVLmWjWcYOej1Z740K+bAPgOjNbYVypai5v0ncGro/O0mDPAtPd/croINHM7P8BJ3bwpVpFL5i7zwHOCirfmG3u+eNTuweUvrrfJ5GIFGhJ4Djgj2b25ugwIjUxEFR313zVuSkiPhM9RUk3WLpZQe/0w/1rgWvNbPke8jRG3qQbatLL8Bywh7tfFh0kmpm9D/hah1/+Nm1BLEXUFuntGrRjaUeyQ6hSGwioKdJ0qwI3mdke0UFEqs7dbwX+HFB6KbLFxNozs2WBaQGlL3L3Uh5R6KhBN7OXANO7uO7ryZr05XpK1RBq0ksxG9jL3aMO56oMM3sPcFIX37IIzZ6fHcLdfw38KqD0ZKApH4Aj7nw/SNwhfyJNNwU4z8w+bmYTosOIVFzUjf6m7MSbDiwaULe0P7dOV9APJftw3403kDXpy3b5fY0ypEnv+xPGCzAb2MfdL4oOEs3MDga+BXT7wedQM4t4EWs6vbn2yMyWIVtBT+1szT4XKd3xwIz8MRYRGVnUTPTtG7KYGvFZ6G5KPG9soQ26mS1C1qD34o1kTXrE1sXKUJNeiDnAfu5+QXSQaGb2TuC7dN+cA6xMd7thpDNnk91ASm1TM1s9oG6RdidbbUttIKCmSD96O9khwn09jldkNIEz0Rel5p8JzWwVYIuA0me6e2k3VTpZQZ/O+EbfbEg2K3OZcVyj9vKTGo2Yv4B1NwfY393Piw4SzcwOAE6ht+Z8kA6LK5i7/xeIOLBwAvWfcR9x5/s37v7zgLoi/WpT4EYzizhlWaQOTguqW/edeHvT/VSyIpS6c7KTf6AiPsy/GbhaTbo/CeyEmvRuzAUOdPdzooNEM7O3k72Aj/eF6C1mtmEBkWRBpYza6EBt31zNbGVgq4DSmn0ukt66ZNvdIz5Mi1Rd1Ez0zc1s1YC6RYn4DPQzd7+zzAJjvkia2TrAxgXVegtwVb/fPR3SpN8YHKUO5gLvcve+n1NsZvuQbckt6oPNuwq6jsznwEMBdTcws/UC6hZhL2BS4pqafS4SZ1fgE9EhRKomfxw2YqfoRLJV6Noxs1ex8BHgZSj9Jv/CPuxbwfU2Bq40s6UKvm6t5E36jqhJH8s84GB37/uVLjPbEziDYhuZnQq8lgDu/gxwblD5uq6iR+S+yt3/E1BXRDLHmdku0SFEKmggqK4+Q3TuWaD0Xb0La9DL+BC/KWrShzbpN0VnqaB5wKHufmp0kGhm9jbgLIpfZVzNzF5b8DUlbut07Z5DN7M1gY0CSg8E1BSRBZ1pZutGhxCpEnf/IfCngNJvMLNWQN3xivjsc7m7P1B2kVEb9PzY/U1Kqvs/wOVmtmRJ168FNemjep+7nxwdIpqZ7Up2l25ySSUiRls1mrvfBvwxoPQaZlbU40ipRNz5foDsUQQRibUUcHG/j+IVGYHGtnYgP0vpVQGlk/z5jLWCvj3lNQYAm5M16UuUWKPy3P0Jskbp5ugsFXG4u387OkQ0M9uZ7FmkRUoso23u5dCba2ci8p6j2ecilbE28KXoECIVM4OYmeh124kX8RnifuCKFIXGatBTrK5tAVxmZosnqFVZeZO+A2rSj3T3b0SHiGZmOwLnU25zDrCRma1Yco1+dAYxb657mlmZN1ULY2avA14dUHogoKaIjO5d+UFPIsLzM9FnBZRe28zeFFC3a/kkiL0CSp/t7s+lKDRig25mk8hW0FPYEnA16c836bdEZwnyQXf/WnSIaGY2DZgJLJqg3ESy/+akQO5+FzGjFFcCtgmo24v9Ampq9rlI9UwCPhsdQqRiBoLqRrw392JLYJWAusnG6Y62gr4xsEKqEMDWwKVmNiVhzcrp4yb9aHc/MTpENDPbjmwO5mIJy+o59HJom/sozGwCMSNd+n4ihEhF7WlmEaOSRKoqaib6XvnqdNVFfNb5Xcqb/KP9IUQ8m7oNcImadH+crEm/NTpLIh9z9y9Hh4hmZlsDFwOp//ufWpdt0TVzIfB4QN1da7AbaXPgZYlrava5SLV9LjqASFUEzkR/CbBVQN2OmdliwO4BpZPe5K9Sgw6wHdmpnilXECsnb9Kn0fwm/ZPu/vnoENHMbEuyk6UjGqsXAZsF1G20fDfMBQGllwYsoG43NPtcRIbbLn8vFJHMQFDdqu/E2wFIPf1hDolv8r+gQTezlwPrpQwxzFTgIjXpzzfpP4zOUpLj3P346BDRzGxz4DJimvNBOs29HNrmPoyZLQJMDyg9EFBTRLrz+fwRGJG+FzgTffeK92ARn3Gudfd7UxYcaWtrFT6sTwNmmtnu/TwSx90fN7PtgauATaPzFOh4d/90dIhoZvY/wOVA9KjBHYEPBmdoopuAvwOvSFx3mpkt6+4PJ67bie2B5RPXbPrs8/8A50SHSCxiSoKUbyNgA+COgq53KmnPU1qY91Pu+OKhvg88lqhWJ5q+I7QspwOpF7NeRPa58MLEdRfKzJYmpk9NvuBS1QYdsv84ZprZ29Sk2zSyJn2T6DwF+IK7fzI6RDQz24RsluJS0VmAlpm90t3/HB2kSdx9npmdAaT+731RslXqUxLX7YRmnxfvn+5+VHQIKcydZIsUZZhM9ozpy4C1yD7vbVxSrV4ZBTXoVdulZ2aHkK5B/4y7/zNRLSnPDOAzjD0Wuwz7UsEGnezZ89RnNT1CdkZUUgu8UJjZkmRH11fFTsD5ZjY91dy5KnL3x4aspNe5Sf+yu380OkQ0M9sIuJLseeGq2An4anSIBppB+gYdsjfXSjXo+fvLzgGlBwJqivTqWXf/R4nX/8uQn3/OzF4GHAAcAyxTYt1O7Uz6FUORSnL3f5nZLNKPUN3RzJZx94iT5McScZP/fHd/OnXR4XdktibtiKdO7Ayclz+72Lfc/TGy7aE/is7SoxPd/ejoENHM7E3A1VTjg9BQGrdWgnxXQsTf2S3MLGJG6Fh2Jf3jHJp9LjIGd7/L3T8HrA18G5gXHOlNZvbS4AwiVTIQUHMKMSelj8rMViLrU1MLOU9oeIP+logQHdgVOLffx0ENadJ/HJ2lS19z975/xjmf83oN2fM9VbORDucpTcSL+0RiZo2PJeLOt2afi3TA3f/r7ocBuwBPBMepyqOWIlUQNRO9agfO7gVMSlzzL+4ecn7C8Ab9NREhOrQ7cI6a9No16d909yOjQ0Qzs9cD15J+NESnlgZeHh2ioX4AJN8eRYXeXM1sRbIxmilp9rlIl9zdyQ6lvTswRsSjMCKVFDgTfSszWzmg7mgiPtPMCKgJvLBBXz8kReemA2erSfdHyZr0n0RnWYjvAIdHh4hmZhuQNefLRWdZiKr//a8ld38EuCSg9BvN7FUBdUeyB+kORxp0pWafi3TP3e8gmzUctZK+jZlFTzcRqZKBgJqTyFatw5nZGqTf5T2PKjTo+dH1dVhB2wM408xSb3OolLxJn0p1m/STgcPcPfp5tlBmtj5wPdUa9TKaKu+gqbt+n4kekWMgoKZII7j7r4H9g8pPATYPqi1SOYEz0fv5M8TN7v73gLrAgivo6wF1eQZ1L+AMNenPN+m3RWcZ5lTgUDXnti5Zc75idJYOaQW9PNcA9wbUDX9zNbPVybbMpnQ/zZ59LlI6d7+IbCdchFcE1RWpqogb/RuZ2VoBdYfruzNshjbodVs92wc43cxSzwaslLxJ347qNOmnAwerObd1gFnAStFZulC314DacPc5wFkBpdfOJwdE2pf0N3/P6efRnCIF+jTweEBdneQusqAZwNyAuqE3+s3sdcC6ics+CVyQuOYChja3dVw92w8YUJP+/Er6T4OjnAm8y90jXkAqI3/udxZQpcM1OrFOv48zLFm/bnPX9naRmsrPcfhyQGk16CJDuPu/yD5bptaPnyEuyg/lDlPnFfRB+wOnqkn3R8hW0qOa9HOAA9Wc29rADdTzw8UiQFUOFWscd/8t8MuA0ntFvT7mZzCkfm/5tbv/InFNkSb7fkDNVQJqilTdaQE118knESWXj/+NGBkbPqK1CQ06wDuAU/p9jnNgk34esH++jbdv5c/p3EC9P1jU+XWgDiJe9F8KbBlQF/rwuTGRpnH3u0n/GF0db3KLlO0i4JGAulGr6JsBqyWueRfZ+VGhJgLkc+7qcpDVaN4JnKwm/fkm/fZEJS8A9lNzbmuQNeerRmcZpzo+6lInZwMRz0ZHvbnuk7ieZp+LlCP1qEg16CLDBM5E3zuov4r47HJmFXYDD66gN2XV7CDgu2rSkzXpFwH7uPvskutUmpm9nKw5T32XrwxNeS2oJHe/D7gyoPTuZrZYyoJmtgnpT2K+0t3/m7imSD+4M3G9lft9Uo/IKAYCar6MxKMP8zORpqesmavELrzBBr1Jq2YHA99Wk+4PkzXpPyupxKXAXmrObXWy5vzl0VkK0qTXgqqKePFfFtghcU0dDifSHHcnrjeR+u/sFCmcu/8IaAeUTv2ePhVYIXHNn7r7HxLXHFHTVtAHHQp8MzpEtLxJ35bim/TLgT36fYyRmb2M7ETNNaKzFGgNM1syOkTDXQY8GFA32ZurmU0G9khVL6fZ5yLluSeg5hMBNUXqIOJG//TEk376+gybJq6gD3qvmX0jOkS0IU36zwu65JXA29z92YKuV0tmtgrZyvla0VkKNgFYLzpEk+V/d84NKL2TmS2dqNY2wEqJag3S7HOR8kxJXO8Z1KCLjCZiJvrywPYpCuULRTunqDVE1GezEU3Mt4I39QP5+8zs69EhouVN+jaMv0m/Btjd3Z8Zf6r6MrOXkjXnr4zOUpKm7aipooi7tFOA3RPV0vZ2kWZJfWjbfe4+L3FNkVpw96iTxlO9t+8CpN7NeZm7R+xuHNFE4CWk/5eQ0uFm9tXoENGGrKT3Oh/4emAXd3+6uFT1k088mEWz54U39cZDZbj7T4GI55xKf3M1s8WBXcuuM4xmn4uUK3WDfn/ieiJ1MxBQc+dEj0H29fZ2yBr0ZaNDJHCEmZ0YHSKauz9EtpLe7QfZGwBTc24rkTXn60RnKdmLogP0iYg3g63z/47LZECqrfSDKvXGKtJAGyeud1/ieiJ1EzETfQlKvgFvZiuQHXKdUtSEnVFNBpaJDpHIUWY2190/FB0kkrs/ZGbbAtcBr+/gW24GdspnL/YtM1uRbBfButFZEuiX14RoZwAnMP8skBQmAXsBJ5VYI/Wd736ffT7FzF4dHaIA9+djCKVi8kchLXFZraCLjMHdnzKz88imV6W0L3BWidffA0h5GB3A2VU7w2Yy/bVa9sG8ST86Okgkd3/QzLZh4U36rcAO7v5kmmTVlN/Nu55mHqY4kn56TQjj7neb2fVkj56ktC8lNehmtiwwrYxrj6HfZ5+/Bvh9dIgCnAB8IjqEjGgd0j/69MfE9UTqaID0Dfp2Zraiu5d1E63vt7dDtnLTbx/GP2xmX4gOES0/CGEb4JejfMmPgGnu3tenqJrZcmQ3MjaIzpJQv70mRIp4U3iLma1Z0rWnA4uWdO3RDCSuJ9JvInYe3hxQU6RWgmailzZG1cxWB/6njGuP4TfuPlovFGYi/bmd9RgzOyE6RLQhTfqvhv3WbWTN+ePpU1VHvhp4HfC66CyJ9eNrQpSLgMcC6pZ1h3q/kq47Gs0+FymRmbWAAxOXfY7sc4iILFzEjf6y3uv3IRv3m9KMxPU60o8r6IM+ZmafjQ4RLW/St2Z+k347MNXdH41LFc/MXkQ2Vu4N0VkC9OtrQnL54yMXBJQuvEE3s1WBzYu+7kJU7rkxkabInz3/MmnPyQD4Wb8/WifShYiZ6JuY2ctLuG7q7e1zqOgZNv3coAN8wsyOiw4RbchK+unAdu6e+lTISjGzZYCrgTdFZwmiFfS0Iu5+v9rMit4ZsjfpP8gPJK4n0k+OJv3hcKDt7SIdC5qJPoFstbswZrYe6R8nvcbd/524Zkf6dYv7UJ8ys2OjQ0Rz9wfc/cB8XnrfMrOlgauAjaKzBOr314TUbgb+HlC36DvVqe9831HF58ZEmsDMpgKfCyqvBl2kOwMBNev+GQIqeDjcoH5fQR/0aTPT6bF9zsyWIpuDmHrea9VMNrMlokP0C3efR8wzUHvnW1jHLX9ONfXjIJV9YxWpMzPbF7iU9DtiIJvrfFNAXZE6i5iJ/hozK3K6UaEr8h14GLgkcc2OaQV9vs+a2ceiQ0gMM1sSuBzYNDpLRejGXVoRDfpqwGYFXSv1ne/nqOhzYyJ1ZWaTzezTZDOOU09jGDTQ79NjRLrl7k8B5wWULuS938w2BtYo4lpdOM/dn05cs2NaQV/QCWb2kegQkla+WnwZ6Q+4qjK9LiTk7n8Bbg0oXVRjnfrO95Xufl/imiKNZGYTzGxH4NdA9CN/3w6uL1JXAwE1i3rv1/b2YdSgv9Dnzezo6BCShpktTraV763BUapGO2vSi1hFn25mi4znAmb2JmDtgvJ0aiBxPZHGMbOXm9mRwI/IblK/OjjSLHf/Y3AGkVoKmon+CjPbZDwXMLNJwJ4F5enUn/N/X5U1GX0QH8kXzWyOu/9fdBApj5lNIXv+ZOvoLBWkG3fpnQd8HZiSsOYKwFSyD+e9Sn3n+37Gl1ekL+Wr5HsAq5I94tKKTfQC34oOIFJzpwMnJK65L9lNvl5tA6xUUJZOVXL2+VCT0Qfx0fyvmc11969EB5HimdliZIdqbBudpaJ04y4xd3/EzC4mG1eW0r702PCa2URgr2LjLJRmn0uTvdbMypoBvigwqaRrj9ddZLvZRKR3M4DPkvaAxz3M7Eh3n93j96e+yR91MG9XtMV9bCea2RHRIaRYZraZWPWTAAAeOklEQVQoMBPYPjpLhel1IUbEM1E754ck9mJL4KVFhunAQOJ6IqktXtKPqjbnAEfrxpvI+OQz0a9LXHYlslXwruU7WXcrNs5C3eTu/0hcs2sTgcWiQ1TcV83s8OgQUoz8edsLgB2js1Rcym3WMt+1wL2Jay4J7NLj92r2uYiM1w3AudEhRBpiIKBmr58FDFi6yCAdqPThcIMmApU9Yr5Cvm5m74sOIeOTN+fnkb0gyNj0uhDA3ecQMz6s6zfX/DGR3UvIMpZavLGKSMdmA+9393nRQUQaImIm+q75ocvdSn2T/wmyRbrKmwg8FR2iJk4ys/dGh5DemNlk4Bxg1+gsNaHXhTgRTeh2ZrZCl9+zA7BsGWFGodnnIs1zorv/PjqESFPks71/kLjs0nS5+GVmywLTyokzqgvd/fHENXuiBr1zE4Bvmtmh0UGkO/kIh7OAt0VnqRG9LgRx998Bv0hcdhG6H3OyXxlBxqDZ5yLNchfZgVYiUqyBgJrdfiaYTvrHrCt/ONwgNejdmQB828wOjg4incmb8zNIP2Ox7vS6ECtiFb3jrWZmtgzpz3EYSFxPRMrzDDC9LqtZInXi7j8G/pi47PZmtlwXX596e/tdwKzENXumBr17E4DvmtlB0UFkbPkIqNOBfaKz1JBeF2KdTbalO6VNzWz1Dr92d9IeJKjZ5yLN8m53vy06hEiDpb7RvyjZqvhCmdkqwBblxnmBM9x9buKaPVOD3psJwMlm9s7oIDKyvDk/jfTbcJtCrwuB3P1+4IrEZSfQ+c2s1He+NftcpDm+4O46T0KkXDOA1A1pp58N9ibtrHao2SGzatB7NwE4xczeER1EFmRmE4BTgAOis9SYXhfiVXKbu5mtDGyVIMtQA4nriUg5LgE+Hh1CpOnc/W7Sz0Tf3MxW7eDrUt/kv83dU2/5Hxc16OMzETjVzPaPDiKZvDn/HqDdDeOj14V4lwMPJK65gZmtt5Cv2QuYlCJMTrPPRZrhJ8D+ddpmKlJzA4nrTSRbHR+Vmb0KeGOaOM+r1eo5qEEvwkRgwMy0lTpY3px/G3h3dJYG0OtCMHd/lmw0YGoLu7Od+s73QOJ6IlK8y4Ct3f2x6CAifSRiJnrVPkM8A5ybuOa4TST9Ck0TTQRONzMdRhbrG4DG4BXjwegAAsSMBBn1dczM1gQ2SpjlObIRiTK62WTv43X/8UTR/2KkMk4FdnP3J6ODiPSToJnobzCz1hi/n7pXuszdH0pcc9wmA3dHh2iIScAZZjbX3VP/Zeh7ZvY14LDoHA3xQP6iLsHc/XYzuxN4dcKya5jZxvmYluFS3/m+QrPPF+qX7v7m6BAiozge+JS7z4sOItKnBoBDEtfcFzh2+C+a2YbAqxJnqd32dshWftWgF2cScJaZaeZ2QmZ2IvD/onM0iF4TqqVKh8Vpe7uIdOIJ4CB3/6Sac5E4QTPRR1slT/0Z4r/AlYlrFkINevEGm/SOZgHK+JjZl4GjonM0jF4TquVM0o9K2dPMFjgIzsxeR9qV/PvIDsoTkXq5Dljf3U+NDiIiQPob/Wub2ZuG/kI+/nivxDnOdvfZiWsWQg16OSYD55jZ7tFBmszMPg98KDpHA+k1oUKCRqWsBGwz7Nc0+1xExvIY2Vba7dz978FZRGS+KsxEfyuwSuIMtdzeDmrQyzQZONfMdo0O0kRmdjzwkegcDaXXhOoJ3eaeT0gYc3RKCQYS1xOR3l1Ktmp+sra0i1RL0I3+vfJV80Gpb/L/2t1/lbhmYSa6+wOADoQqxyLAeWa2c3SQJjGz44CPR+doMDXo1XMR8GjimruZ2eL5zzcDVktY+446v7GK9Ik5ZFMWXuvuu7j7P6MDicioBhLXeymwJYCZLQa8LXH92q6eQ7aCDnBPaIpmWwQ438wsOkgTmNkngU9F52g4NegV4+5PARckLrs0MPi6tV/i2gOJ64lI554Evg6s5e5vd/dfRwcSkYWKmIk++NlhB2DZhHUHbx7W1mCDfldoiuZbFLjAzHaMDlJnZvYx4DPROfqAGvRqCtnmbmaLACkPvdTsc5Fq+7C7H+Hu/4gOIiKdCZqJvnu+ep56e/vV7v6fxDULNdiga1tS+RYFZprZtOggdWRmRwMnROfoE/+KDiAjugX4W+Ka08iePV8+YU3NPhepts+b2SuiQ4hI1wYS13sR2WeInRLXrfX2dpjfoP8uNEX/WAy4yMymRgepEzP7IPDF6Bx94l53fzA6hLxQfvDSjMRlFwW+lrjmQOJ6ItKdZYAZw0cxiki1Bc1E/wowJWG9h4FLEtYrxeT8f38TmqK/LAZcbGa7uPs10WGqzsyOBP43Okcf0WtBtc0gO4NhQsKayyWspdnn0u/uB87s4usnAAcBS5UTZ1SbAccAn0tcV0TG53TS/r1N+RkC4Afu/kzimoUbbNB1wEdaU4BLzMzcPfXYg9ows/eT3XmTdPRaUGHu/lczu5Xsw3ETafa59Lu73f2obr7BzH4LnFxSnrEcZ2bXuPvPAmqLSG9mAMczfxd109R+ezvkfzju/i+yLQGSzhTgUjPbKjpIFZnZe4GTonP0Ia2gV18j3nxGMRAdQKSGvg9cGVB3MnCWmS0ZUFtEepDPRL82OkdJ2vk2/tobevdEH8zTWxxwM9syOkiVmNkhwDejc/QpraBX3/nAU9EhSqDZ5yI9yM+neDfwUED5VwEnBtQVkd4NRAcoyRnRAYqiBj3eEsBlZrZFdJAqMLODgO+Q9hlbycwG7owOIWNz90eBi6NzlGAgOoBIXbn7PcD7gsofYma7BNUWke5dTPN2Ts+joQ26Vs7iLAFcbmabRweJZGYHkj1Hp+Y8RrsJB2v0iaZtc9fsc5HxO5dsh02EU8zsJUG1RaQLQTPRy3aju/8jOkRRtIJeHUuSNen/Ex0kgpntT/YcnZrzOHoNqI/rgHuiQxRIs89Fxinf6n4Y8J+A8isCp5mZ3sNF6mEgOkDBGrVwMbxBnxcVRIBsTMqVZrZpdJCUzGxfsheKpp4oWRd3RAeQzrj7HLobxVR1A9EBRJrA3e8HDgkqvz1x2+xFpAvu/hPgD9E5CvIEMDM6RJGeb4jc/TG0zb0KBpv0jaODpGBme5GNfFBzHu+H0QGkK025W6zZ5yIFcvdLibvp9WUzWzeotoh0pymfI2a6++PRIYo0vCm6MSKEvMDSwFVmtlF0kDKZ2XSyVcBJ0VmEp4DbokNI59z990AT5g+fpdnnIoU7EvhXQN0pwNlmtlhAbRHpzhnA3OgQBWjKjYbnqUGvrmWAq83szdFBymBmuwPnkM1RlXg/0QFxtdSEN6XTogOINI27PwK8M6j8a4Hjg2qLSIcaMhP9n8AN0SGKNrxBvxk9h14lLwKuMbM3RQcpUj6O5VzUnFfJjdEBpCfnkJ2AXle/cnc9WiVSAne/HvhGUPkPmtlWQbVFpHMD0QHG6cz8gMxGWaBBd/cH0XPoVTPYpL8xOkgRzGwn4DxgkegssoAbowNI99z9Aer9/PZAdACRhjsG+FNA3QnADDNbPqC2iHSu7jPRm7CT8AVGWsG8kWx7klTHssC1Zra1u/8yOkyvzGwHslMWF43OIgvQ8+f1djqwa3SIHmj2eTFWN7OvRIdI7ANNXDEpg7s/aWbvAG4l/WGsqwLfMbO99OclUk3u/rSZ/QA4NDpLD37i7u3oEGUYqUG/ATgidRBZqOWA6/Im/VfRYbplZlOBC1FzXkU/1vPntXY5cD/ZHOI6uTwfCSXjszLZgWD95EPAnOgQdeHuPzazLwEfCSi/B3AZ2bQWEammAerZoDdy9RxGvpt6M8040a+Jlidr0mu1w8HMtiHbQqNTXavpxugA0rv8BPRzonP0YCA6gEgf+TTwm6Da3zCzNYJqi8hC1HQm+jPAD6JDlOUFDbq7PwTcEZBFOrMCcL2ZbRAdpBP5ITGXko1ekWpq3OmXfahud5H/S72fnReplXyX1AHA7IDySwNnmpkOhhWprrp9jrg071kbabTnkS5NmkK6Ndikrx8dZCxm9lbAgcWDo8jo7gN+HB1Cxsfdfw78LjpHF85294hGQaRv5Y/HHRdUfhPgo0G1RWTh6jYTvW43FLoyWoM+M2kK6cWKwCwzWy86yEjMbDOy586WiM4iY7rY3fUsZzPU6RlPzT4XifEF4Pag2sea2UZBtUVkDDWbif4f4OroEGUasUF3998AjTwVr2FeTNakrxsdZCgz2xS4AlgyOosslG7GNceZ1OPgLM0+FwmS71w5AHg6oPwksq3uSwXUFpGFG4gO0KHG78Ib63mgmWg7Uh2sRNakb+nud0aHMbO3AFcCegOuvoeAWdEhpBjufo+ZXQdMjc6yEAPRAUT6mbv/wcw+CkSM53sl8FXg3QG1RWRsgzPRl40OshClbG/Pd/gM9PjtV7n7UWZ2ErBN/mu/d/e3dVj7PQyZojbWTMwLegwo6a1M1qS3IkOY2ZvJtpwsHZlDOnZpfgK4NEfVn8nS7HORavg6cFNQ7YPMbLeg2iIyCnd/muqfjH6Hu5d1mPkSwDo9/lg1v8aqQ35t904eRTazCWTjUp+/3qgNurv/Avhb9/9sEuQlwA1m9qqI4ma2IXANsExEfemJbsI1z8XAo9EhxqDZ5yIV4O5zgXcCjwdFOMXMVgmqLSKjG4gOsBBlLkTMBZ4a4cczQ75mzihf8+wo1+xkt9BmwAKLrAsbeTET+FAHF5ZqeClZk/5Wd/9TqqJm9nqy5vxFqWrKuD1KfQ4DkQ65+1Nmdh7V3T46EB1ARDLu/jczOwo4OaD88sBpZjYtv1kgIhXg7j8xsz+QreRWzWxK3IXn7jcxwuHWZvYaYPDsnO+5+2FdXPYAM/tovjthNAcP/4WxtriDDpCqo1XImvRXpihmZq8FrgOWS1FPCnNZPhdXmqeq29w1+1yker5Pdm5MhO2Aw4Nqi8joqvo54ip3/290iC4tD4z6SI+ZLQdMH/7rC2vQbwP+Mb5cEmBVsiZ9rTKL5HeUriP7j0/q5bzoAFIOd78V+Gt0jhE0/tRVkbpx93lkO24eCorwxfyzhIhUR1VnotdpnCzAvPx/X7BCPsTbgSnDvn7sBj1/4f7+uKJJlJeRNelrlHHx/NCD68nmsUu93INWMpuuim9imn0uUkHufg/wvqDyiwFnmdmUhX6liCSRz0S/JjrHMA8Bl0aH6NLgv8MtR9rZnB8ON9i8Pwj8bPD3FraCDnAK2Z5/qZ/VyJr0VxR5UTN7Ndl4rhcXeV1J5vtayWy8GQy5E1sBmn0uUm3nAucH1X4N8Lmg2iIysoHoAMP8oIaPZg5d5B7pbKA3k73+AZzJkMPoFtqgu/u9gI8nnYR6OVmT/vIiLpaPcptFNn9d6mcOMQcCSULu/jfglugcQ2j1XKTC8h2ThwH/CYpwlJltG1RbRF5ocCZ6VVT1ufix3AT8Jf/5gWa2yLDfH7r1fYEd652soAN8p8dgUg2vIGvSVx/PRfIRbjeQjXSTerrS3f8VHUKSqMqb2bNo9rlI5eUjEA8JjDBgZisE1heRXL5afW50jlzb3X8SHaIH84BT85+vDNjgb5jZ0sDe+f/92fBdhp026Ncy/w6A1NMaZE36ar18c/7sxCyyUW5SX9+NDiDJnA88GR2CbPb5A9EhRGTh3P1S4ra2rgJ8L38uU0TiDUQHyFVlwaEXpzP/wL2hK+b7AEvmPz+VYTpq0POtT9oWW39rkjXpq3bzTWa2JtnKeVffJ5XzT+CK6BCShrs/BlwUnYPqvMGLSGeOBKJ2Wu0OHBhUW0SGcPfbgDuDY8wlO1W+lvID967K/+/UIY8cDzbrTwPnDP++TlfQIevun+05oVTFWsCNZrZKJ1+cHzB3A9mp8FJvp7h7FcdmSHmiT3P/L7opJFIr7v4I8M7ACF8ve0ysiHQsevX6xgY8mjn4fPkE4F1m9jpgw/zXLnD3Fzzr33GD7u73AReOO6JUwSvJVtLHbNLzuzw3AON6dl0qYTbZRAbpL9cBdwfWP0sTA0Tqx92vB74RVH4p4EwzmxxUX0TmO4PsgOEo0TcIinAZcF/+83cB7xnyeyOOM+9mBR3g/3oIJdX0KmCWmY144Fv+rPossgPmpP7OyScySB/Jd0ycGRhBp7eL1NcxwJ+Car8F+ERQbRHJufs9ZGeRRXgcmBlUuzDu/izzdzS+jPmHcf6F7KT3F+iqQXf3nwFX9xpQKqdFtpK+8tBfzJ9Rv4HsmXWpv7loxmw/i7r7/Et3/01QbREZJ3d/EngH8w84Su2TZrZxUG0RmW8gqO5Md38iqHbRhh4EN3gQ5qn5OW8v0O0KOsBne/geqa51yJr0lQDM7KVkzbme/2qOC9z9D9EhJIa73wncHlB6IKCmiBTI3X8MfCmo/ESyre5LB9UXkUzUTPQmbG8HwN1/DwwdFTeXMf75um7Q3f2HZA2cNMeryba7b0D2Z7t2cB4pzjzg+OgQEi71m5xmn4s0x6eBqN0wawJfD6otIoTNRP8HcGPimmUb+rz5VfkJ7yPq9QCOzwJb9vi9Uk0vJmvMV4gOIoW6RNuMhWyEx1uYv62qbL/v89nn96AbFGVKveX6P6T78/xnojodc/dnzGx/4MNBERYxszXc/W9B9YtyDjAlUa2mbAtemH+S7u9m9LixaN8GUu5muXa07d8BHmb+f2cL25F4M/Bk/vNnhv3eD4C35j8f6eDma8huTPT+Yc3MbgU27fX7pVLuA7Z099/lR//PApYLziTF2NDdfx4dQkREREREFq6XZ9AHadtsMzwAbO3uvwNw918B2wGPhKaSIlyp5lxEREREpD56btDd/SpiDh6S4jxI1pwvsAU6P61/KvBYSCopig50FBERERGpkfGsoAN8vJAUEuEhYBt3v2Ok33T324Bp9M9zTE1zeX76roiIiIiI1MS4GnR3vxa4rKAsks7DwLbu/suxvig/sX9H5h92IPXwHPCB6BAiIiIiItKd8a6gA3yQrCGQengEmNrps8nufhOwC/B0qamkSN9w93Z0CBERERER6c64G/S8ETipgCxSvseA7d39p918k7tfB+zGC8cFSPXcBxwXHUJERERERLpXxAo6wGfIGgOprseBae7+k16+OT8UcDraLVF1n3R3ncAvIiIiIlJDhTToeUPwiSKuJaV4Atghf6a8Z+5+GbAXMLuQVFK0O4CTo0OIiIiIiEhvilpBBziFrEGQankS2NHdbyniYu5+EbAfMKeI60mhjnT3udEhRERERESkN4U16HljcGRR15NCPAVYftBbYdz9POAdgJrB6rjQ3W+MDiEiIiIiIr0rcgWdvEE4vchrSs+eBnZ291llXNzdzwIOAuaVcX3pyiPAEdEhRERERERkfApt0HNHAneXcF3p3DPArvnp66Vx9wHgUNSkR/uAu98VHUJERERERMZnUtEXbLfbT7darTvJnlOW9J4FdstPXS9du93+RavVug/YMUU9eYEr3P3D0SFERERERGT8Cm/QAdrt9p9brdbqwOvLuL6M6lngbe5+Rcqi7Xb79lar9Qiwfcq6wsPAtHa7/Vh0EBERERERGb8ytrgP+gDwrxKvLwt6DtgzH4WWnLt/FTg6onYfO9Ld9TiJiIiIiEhDlLKCDtBut59ptVq/A/Yvq4Y8bzawt7tfHBmi3W7/qNVqzQa2iszRJy5z92OiQ4iIiIiISHFKa9AB2u32X1qt1suAN5RZp8/NBvZx95nRQQDa7fYtrVZrIrBFdJYGewjYQVvbRURERESapcwt7oM+APw1QZ1+NAd4u7tfEB1kKHc/Fvh8dI4Ge7+73xMdQkREREREilXqCjpAu91+ttVq3QK8A5hcdr0+Mgc4wN3PjQ4ykna7fX2r1Voa2CQ6S8N8x92/EB1CRERERESKV3qDDtBut//darXuBXZJUa8PzAXe6e5nRQcZS7vdvqbVaq0AbBSdpSF+CuzZbrfnRAcREREREZHiJWnQAdrt9i9brdZq6Hn08ZoLHOTuM6KDdKLdbl/ZarVeAmwYnaXm7ge2dveHooOIiIiIiEg5UjyDPtT7gV8krtkk84BD3H0gOkiXDgO+Hx2ixuYC+7m7xhaKiIiIiDRY0gbd3Z8GppOdQi3dmQe8x91r1+i6+zzgEKAWq/4VdJy7XxMdQkREREREypV6BR13/xvZbPR5qWvX3Pvc/XvRIXrl7nOBdwLnRGepmSuAz0aHEBERERGR8iV7Bn2odrv9J83K7srh7v6t6BDj1W6357VarUuAdfMfMra/AtPc/anoICIiIiIiUr6QBh2g3W7f2Gq11gJeG5WhJo5095OiQxSl3W7PbbVaFwMbAOtE56mw+4Et3f3u6CAiIiIiIpJG8i3uwxwEXBucoco+6O5fiw5RNHd/DtgTuDw6S0U9Cezk7n+KDiIiIiIiIumENuh5o/Y24JeROSrqGHc/MTpEWdz9WbI/ex1+tqA5wN7uflt0EBERERERSSt6BR13fwzYEfhHdJYK+Zi7fyk6RNnc/RlgV2BWdJYKOczdPTqEiIiIiIikF96gA7j7vcD2wIPRWSrgU+7++egQqeQHoBlwc3SWCji+zif1i4iIiIjI+EyIDjCUmW0KXAdMic4S5DPufmx0iAhmthRwNbBJdJYgA+7+zugQIiIiIiISpxIr6IPc/Ydkh4c9G50lwAn92pwDuPvjwDTg9ugsAS4GDo4OISIiIiIisSq1gj7IzHYEZgKLRWdJ5Avu/tHoEFVgZssC1wNviM6SyAXAPu4+OzqIiIiIiIjEqmSDDmBmU8lWFpu+3f1/3f3D0SGqxMyWB24gm5XeZD8A3q7mXEREREREoMINOoCZbQNcCiwenaUkX3H3D0SHqCIzezFZk75edJaSnAW8w93nRAcREREREZFqqHSDDmBmWwIOLBmdpWBfd/cjokNUmZmtDNwEtKKzFOx04F3uPjc6iIiIiIiIVEflG3QAM9sMuAJYKjpLQb7p7u+PDlEHZrYKWZP+yugsBfk+cIiacxERERERGa5Sp7iPxt1vAaYCD0VnKcB3gMOjQ9SFu98DbAX8LTpLAb4JHKzmXERERERERlKLFfRBZtYCLgfWis7So5OBQ919XnSQujGzlwM3A6tHZ+nBXOBod/+/6CAiIiIiIlJdtWrQAcxsReASYJPoLF06DThIzXnvzGxNsiZ91egsXXiS7KT2i6KDiIiIiIhItdVii/tQ7n4/2Zbnc6OzdGEG8G415+Pj7n8l+7O/NzpLh/4NbKHmXEREREREOjEpOkAv2u32nFardSEwGdg8Os9CnAkcqOeOi9Futx9otVpXAHtQ7ZP9fwts6e53RgcREREREZF6qN0W9+HM7EDge8AiwVFGcg6wv2ZdF8/M1iebk75idJYRXAPs4e6PRgcREREREZH6qN0W9+HcfQDYFvhPcJThzkPNeWnc/bfANsCD0VmGOQnYUc25iIiIiIh0q/Yr6IPMbGXgLGDr6CzATGBvd58dHaTpzOyNwPXAi4KjPEx2COCFwTlERERERKSmavkM+kja7fYTrVbrTGAO2XPpUbsDLkbNeTLtdvveVqt1A7AXsFhQjJ8C27r7j4Pqi4iIiIhIAzRmBX0oM9sCOBtYJXHpS4Hp7v5c4rp9z8w2Ba4m/cFxXwGO0Z+5iIiIiIiMVyMbdAAzezFwBjA1UcnLgd3d/dlE9WSY/MbMFcASCco9SHY6vyeoJSIiIiIifaAxW9yHa7fbT7ZarbOAp4EtKPef9SrUnIdrt9v/aLVatwF7ko3gK8sPge3c/fYSa4iIiIiISJ9p7Ar6UGb2GuAU4M0lXP4aYBd3f7qEa0sPzGwqcAnFP5P+BPAx4Buaay8iIiIiIkXriwYdwMwmAkcAx1PcFujrAXP3pwq6nhTEzHYCLgQWKeiSVwOHuvs/CrqeiIiIiIjIAvqmQR9kZmsA3yWbnT4eN5DNu1ZzXlFmthvZPPrxbHd/ADjK3c8oJpWIiIiIiMjI+q5BH2RmBwInAsv18O03A9Pc/clCQ0nhzGxPshP9ezmD4BzgCHe/r9hUIiIiIiIiL9S3DTqAma1MNiZrny6+7Vay5vzxclJJ0cxsX7IT/Sd2+C1/Aw5398vLSyUiIiIiIrKgvm7QB5nZRsD/Av+zkC/9EbC9uz9Wfiopkpm9AziNsf+bf4jsjIJv6ER+ERERERFJTQ36EGa2K/BF4FUj/PZtZKO1Hk2bSopiZgeTnT8w/L/7Z4BvACe4+0PJg4mIiIiIiKAG/QXMbDJwCHAssFL+y7cD27r7I2HBpBBmdhjwzfz/zgPOBT7m7n8PCyUiIiIiIoIa9FGZ2dLAMcAWZKPUHg6OJAUxsyOA3YAPufvPovOIiIiIiIgA/H+uNtElLuo6cQAAAABJRU5ErkJggg==';
			doc.moveDown().image(logo, 470, 17, {
				width: 100,
			});
			doc.lineCap('butt').strokeColor('#fe5b1b').lineWidth(10).moveTo(0, 0).lineTo(610, 0).stroke();
			doc.lineWidth(1);
			pdfRow1Details(doc, param);
			pdfRow2Details(doc, param);
			pdfRow3Details(doc, param);
			let yvalue = pdfRow4Details(doc, param);
			yvalue = pdfRow5Details(doc, param, yvalue);
			doc.addPage();
			doc.lineCap('butt').strokeColor('#fe5b1b').lineWidth(10).moveTo(0, 0).lineTo(610, 0).stroke();
			doc.lineWidth(1);
			yvalue = 25;
			yvalue = pdfRow6Details(doc, param, yvalue, false);
			yvalue = pdfRow6Details(doc, param, yvalue, true);
			yvalue = pdfRow7Details(doc, param, yvalue);
			yvalue = pdfRow8Details(doc, param, yvalue);
			yvalue = pdfRow9Details(doc, param, yvalue);
			doc.image(logo, 450, yvalue - 60, {
				width: 100,
			});
			const leftTextAlign = {
				width: 200,
				align: 'left',
			};
			doc.fillColor('black');
			doc.font('Times-Roman').fontSize(8);
			doc.text('For Queries, please contact our Customer Care Center', 26, yvalue - 60, leftTextAlign);
			doc.text('T : 1800 209 6070', 26, yvalue - 45, leftTextAlign);
			doc.text('Vertiv Energy Private Limited', 26, yvalue - 30, leftTextAlign);
			doc.text('ISO N0. : QS-FM-SER-0-03-00', 450, yvalue - 20, leftTextAlign);
			doc.end();
		},
	},
);

API.v1.addRoute(
	'report.getpdf',
	{ authRequired: false },
	{
		get() {
			const params = this.requestParams();
			if (!params.call_no) {
				throw new Meteor.Error('error-room-param-not-provided', 'The parameter "call_no" is required');
			}
			const room = Rooms.findOneByName('general');
			if (room.customFields) {
				return room.customFields[params.call_no];
				// delete current[key];
			}
		},
	},
);

API.v1.addRoute(
	'report.deletepdf',
	{ authRequired: false },
	{
		get() {
			const params = this.requestParams();
			if (!params.call_no) {
				throw new Meteor.Error('error-room-param-not-provided', 'The parameter "call_no" is required');
			}
			const room = Rooms.findOneByName('general');
			if (room.customFields) {
				delete room.customFields[params.call_no];
				// delete current[key];
				Rooms.setCustomFieldsById(room._id, room.customFields);
			}
		},
	},
);
