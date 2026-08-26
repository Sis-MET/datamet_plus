const ivmetService = require('../services/ivmet.service');

const respond = (res, data) => res.status(200).json({ success: true, data });

const getOverview = async (_req, res, next) => {
  try {
    respond(res, await ivmetService.getOverview());
  } catch (error) {
    next(error);
  }
};

const getClients = async (_req, res, next) => {
  try {
    respond(res, await ivmetService.getClients());
  } catch (error) {
    next(error);
  }
};

const getPlans = async (_req, res, next) => {
  try {
    respond(res, await ivmetService.getPlans());
  } catch (error) {
    next(error);
  }
};

const getEquipmentReview = async (_req, res, next) => {
  try {
    respond(res, await ivmetService.getEquipmentReview());
  } catch (error) {
    next(error);
  }
};

module.exports = { getOverview, getClients, getPlans, getEquipmentReview };
